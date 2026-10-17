// Public signup/login; reset requires the backend administrator API key.
// Credentials, request bodies, user identifiers and upstream errors are never logged.
const origin = 'https://classroom-polynomial-forest.vercel.app';
const enc = new TextEncoder();
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b=>b.toString(16).padStart(2,'0')).join('');
const digest = async (name: string) => hex(await crypto.subtle.digest('SHA-256',enc.encode('forest-account-v1:'+name)));
function equal(a: string,b: string) { if(a.length!==b.length) return false; let diff=0; for(let i=0;i<a.length;i++) diff|=a.charCodeAt(i)^b.charCodeAt(i); return diff===0; }
Deno.serve(async req => {
 const source = req.headers.get('origin');
 const headers: Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(source===origin) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,apikey','Access-Control-Allow-Methods':'POST, OPTIONS'});
 const reply = (data: unknown,status=200) => new Response(JSON.stringify(data),{status,headers});
 if(source && source!==origin) return reply({error:'허용되지 않은 요청입니다.'},403);
 if(req.method==='OPTIONS') return source===origin ? new Response(null,{status:204,headers}) : reply({},403);
 if(req.method!=='POST') return reply({},405);
 try {
  const base = Deno.env.get('SUPABASE_URL')!;
  const key = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!base || !key) throw new Error('Configuration');
  if(!req.headers.get('content-type')?.startsWith('application/json')) return reply({},415);
  // Stream cap protects against oversized bodies even without Content-Length.
  const reader=req.body?.getReader(); if(!reader) return reply({},400);
  let total=0; const chunks: Uint8Array[]=[];
  while(true) { const part=await reader.read(); if(part.done) break; total+=part.value.byteLength; if(total>2048) { await reader.cancel(); return reply({},413); } chunks.push(part.value); }
  const buffer=new Uint8Array(total); let offset=0; for(const chunk of chunks) {buffer.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder().decode(buffer));
  if(!body || Object.keys(body).sort().join(',')!=='action,password,username') return reply({},400);
  const {action,username,password}=body;
  if(!['signup','login','reset'].includes(action) || typeof username!=='string' || !/^[a-z][a-z0-9_]{3,23}$/.test(username) || typeof password!=='string' || password.length<12 || enc.encode(password).length>72) return reply({error:'아이디는 영문 소문자로 시작하는 4~24자(숫자·밑줄 포함), 비밀번호는 12자 이상·UTF-8 72바이트 이하로 입력하세요.'},400);
  const admin=action==='reset';
  if(admin && !equal(req.headers.get('apikey') || '',key)) return reply({},403);
  const d=await digest(username), email=d+'@accounts.invalid';
  const privileged: Record<string,string>={apikey:key,'Content-Type':'application/json'};
  if(!key.startsWith('sb_secret_')) privileged.Authorization='Bearer '+key;
  const rpc=async(name:string,args:unknown) => {
   const r=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:privileged,body:JSON.stringify(args)});
   if(!r.ok) throw new Error('Database'); const text=await r.text(); return text ? JSON.parse(text) : null;
  };
  const auth=async(route:string,method:string,data:unknown) => fetch(base+'/auth/v1/'+route,{method,headers:privileged,body:JSON.stringify(data)});
  if(admin) {
   const id=await rpc('forest_invalidate_account',{account_digest:d});
   if(!id) return reply({error:'계정을 찾지 못했습니다.'},400);
   const r=await auth('admin/users/'+id,'PUT',{password});
   if(!r.ok) throw new Error('Reset');
   return reply({ok:true});
  }
  const hkey=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const ipHash=hex(await crypto.subtle.sign('HMAC',hkey,enc.encode(ip)));
  const checks=await Promise.all([
   rpc('forest_auth_limit',{bucket_key:'account:'+d,maximum:20}),
   rpc('forest_auth_limit',{bucket_key:'network:'+ipHash,maximum:120}),
   rpc('forest_auth_limit',{bucket_key:'global:'+await digest('global'),maximum:250})
  ]);
  if(checks.some(ok=>ok!==true)) return reply({error:'시도 횟수가 많습니다. 15분 후 다시 시도하세요.'},429);
  if(action==='signup') {
   const r=await auth('admin/users','POST',{email,password,email_confirm:true});
   if(!r.ok) return reply({error:'가입하지 못했습니다. 다른 아이디로 시도하거나 선생님께 문의하세요.'},400);
   const payload=await r.json(); const user=payload.user || payload;
   try {await rpc('forest_register_account',{account_id:user.id,account_digest:d});}
   catch { // Compensate only the account just created by this request; no existing account is deleted.
    if(typeof user.id === 'string') await fetch(base+'/auth/v1/admin/users/'+user.id,{method:'DELETE',headers:privileged});
    return reply({error:'가입을 완료하지 못했습니다. 선생님께 문의하세요.'},503);
   }
  }
  const r=await auth('token?grant_type=password','POST',{email,password});
  if(!r.ok) return reply({error:'아이디 또는 비밀번호를 확인하세요.'},400);
  const session=await r.json();
  return reply({access_token:session.access_token,refresh_token:session.refresh_token});
 } catch (error) { console.error('forest-account failure', error instanceof Error && ['Configuration','Database','Reset'].includes(error.message) ? error.message : 'Internal'); return reply({error:'계정 요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.'},503); }
});
