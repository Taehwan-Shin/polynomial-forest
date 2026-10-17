import { createClient } from '@supabase/supabase-js';
import { renderPolynomialGame } from './polynomial-view.mjs';
import { cleanRecord } from './polynomial-data.mjs';
import { completion } from './records.mjs';

const main = document.querySelector('#main'), status = document.querySelector('#account-status');
const login = document.querySelector('#account-form'), logout = document.querySelector('#logout');
const submit = document.querySelector('#sign-in'), signup = document.querySelector('#sign-up'), password = document.querySelector('#password');
let endpoint, busy = false;
const memory = new Map();
// Persist only the PKCE verifier across the OAuth redirect. Profiles and tokens stay in memory.
const storage = {
  getItem(key) { return key.endsWith('-code-verifier') ? sessionStorage.getItem(key) : memory.get(key) ?? null; },
  setItem(key, value) { if (key.endsWith('-code-verifier')) sessionStorage.setItem(key, value); else memory.set(key, value); },
  removeItem(key) { if (key.endsWith('-code-verifier')) sessionStorage.removeItem(key); else memory.delete(key); }
};
let client, cleanup, userId = null, generation = 0, booting = true;
function message(text) { status.textContent = text; }
async function activate(user) {
  const current = ++generation; userId = user?.id || null;
  cleanup?.(); cleanup = null; main.replaceChildren();
  login.hidden = Boolean(user); logout.hidden = !user;
  if (!user) { message('로그인 전에는 이 브라우저에만 기록합니다. 계정으로 자동 이전하지 않습니다.'); cleanup = renderPolynomialGame(main); return; }
  message('내 학습 기록을 불러오고 있어요…');
  const id = user.id;
  const ensureOwner = () => { if (userId !== id || current !== generation) throw new Error('Session changed'); };
  const backend = {
    makeCompletion: completion,
    async load() {
      ensureOwner();
      const [summary, recent] = await Promise.all([
        client.from('forest_summary').select('record').eq('user_id', id).maybeSingle(),
        client.from('forest_attempts').select('stage,character,mode,score,correct_count,created_at').eq('user_id', id).order('created_at', { ascending: false }).order('attempt_id').limit(20)
      ]);
      ensureOwner(); if (summary.error || recent.error) throw new Error('Read failed');
      return { record: cleanRecord(summary.data?.record), history: recent.data || [] };
    },
    async complete(attempt) {
      ensureOwner(); if (!attempt) throw new Error('Missing attempt');
      const result = await client.from('forest_attempts').insert({ ...attempt, user_id: id });
      if (result.error?.code === '23505') {
        const existing = await client.from('forest_attempts').select('attempt_id,stage,character,mode,score,correct_count,hits,acorns,answers').eq('user_id', id).eq('attempt_id', attempt.attempt_id).single();
        if (existing.error || Object.keys(attempt).some(k => JSON.stringify(existing.data[k]) !== JSON.stringify(attempt[k]))) throw new Error('Conflicting attempt');
      } else if (result.error) throw new Error('Write failed');
    },
    async reset() { ensureOwner(); const result = await client.from('forest_attempts').delete().eq('user_id', id); if (result.error) throw new Error('Delete failed'); ensureOwner(); }
  };
  try {
    const data = await backend.load(); if (current !== generation) return;
    backend.initialRecord = data.record; backend.history = data.history;
    cleanup = renderPolynomialGame(main, backend); message('로그인 완료 · 학습 기록은 내 계정에 저장합니다.');
  } catch {
    if (current !== generation) return;
    message('학습 기록을 불러오지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.');
    const retry = document.createElement('button'); retry.textContent = '기록 다시 불러오기'; retry.addEventListener('click', () => void activate(user)); main.append(retry);
  }
}
async function authenticate(action) {
  if (!client || busy || !login.reportValidity()) return;
  const username = document.querySelector('#username').value.trim().toLowerCase();
  if (action === 'signup' && password.value !== document.querySelector('#password-confirm').value) { message('가입할 때 비밀번호 확인도 같은 값으로 입력하세요.'); return; }
  busy = true; submit.disabled = signup.disabled = true;
  try {
    const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,username,password:password.value}) });
    const result = await response.json();
    if (!response.ok) { message(typeof result.error === 'string' ? result.error : '계정 요청을 처리하지 못했습니다.'); return; }
    const signed = await client.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token});
    if (signed.error) throw new Error('Session');
    login.reset(); await activate(signed.data.user);
  } catch { message('계정 연결을 완료하지 못했어요. 잠시 후 다시 시도하세요.'); }
  finally { password.value = ''; document.querySelector('#password-confirm').value = ''; busy = false; submit.disabled = signup.disabled = false; }
}
login.addEventListener('submit', event => { event.preventDefault(); void authenticate('login'); });
signup.addEventListener('click', () => void authenticate('signup'));
document.querySelector('#forgot').addEventListener('click', () => message('비밀번호를 잊었다면 담당 선생님에게 직접 문의하세요. 선생님이 본인을 확인한 뒤 재설정합니다.'));
logout.addEventListener('click', async () => {
  logout.disabled = true;
  try { const result = await client.auth.signOut({ scope: 'local' }); if (result.error) throw new Error('Logout failed'); memory.clear(); await activate(null); }
  catch { message('로그아웃하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.'); }
  finally { logout.disabled = false; }
});
try {
  const response = await fetch('./public-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Missing config');
  const config = await response.json();
  if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(config.url) || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)) throw new Error('Invalid config');
  endpoint = config.url + '/functions/v1/forest-account';
  client = createClient(config.url, config.key, { auth: { flowType: 'pkce', storage, persistSession: true, detectSessionInUrl: false } });
  await activate(null);
  booting = false;
  client.auth.onAuthStateChange((_event, session) => {
    if (!booting && (session?.user?.id || null) !== userId) queueMicrotask(() => void activate(session?.user || null));
  });
} catch {
  submit.disabled = signup.disabled = true; message('계정 연결을 준비하지 못했어요. 새로고침 후 다시 시도해주세요.');
  cleanup = renderPolynomialGame(main);
}
window.addEventListener('pagehide', () => { ++generation; cleanup?.(); memory.clear(); main.replaceChildren(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
