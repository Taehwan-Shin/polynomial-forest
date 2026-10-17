import { stages, badges, STORAGE_KEY, cleanRecord, completeRecord } from './polynomial-data.mjs';
import { WIDTH, HEIGHT, GROUND, FINISH, gates, logs, platforms, createRun, jump, advance, answer, continueRun } from './polynomial-engine.mjs';

// Native canvas drawing keeps assets local, with no third-party image or font dependencies.
function oval(ctx, x, y, rx, ry, fill, stroke = '#422b20') {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
export function drawCharacter(ctx, character, x, y, facing = 1, phase = 0) {
  ctx.save(); ctx.translate(x + 17, y + 24); ctx.scale(facing, 1);
  const foot = Math.sin(phase) * 3;
  if (character === 'squirrel') {
    oval(ctx, -22, -5, 16, 23, '#bd652f'); oval(ctx, -25, -13, 9, 12, '#e59658');
    oval(ctx, 0, 6, 13, 17, '#bd652f'); oval(ctx, 4, 9, 7, 11, '#ffe1b2');
    oval(ctx, 4, -18, 5, 10, '#bd652f'); oval(ctx, 16, -17, 5, 9, '#bd652f');
    oval(ctx, 9, -9, 14, 12, '#d98143'); oval(ctx, 18, -4, 7, 6, '#ffe1b2');
    oval(ctx, 15, -11, 2, 3, '#171717', null); oval(ctx, 23, -5, 2, 2, '#171717', null);
    oval(ctx, -6, 21 + foot, 8, 4, '#bd652f'); oval(ctx, 10, 21 - foot, 8, 4, '#bd652f');
  } else {
    oval(ctx, -10, 19 + foot, 8, 5, '#809363'); oval(ctx, 11, 19 - foot, 8, 5, '#809363');
    oval(ctx, -1, 4, 23, 18, '#7a8050'); oval(ctx, -1, 2, 16, 12, '#a5ac75');
    ctx.strokeStyle = '#59623c'; ctx.beginPath(); ctx.moveTo(-1,-10); ctx.lineTo(-1,14); ctx.moveTo(-16,2); ctx.lineTo(15,2); ctx.stroke();
    oval(ctx, 23, 2, 12, 10, '#9aaf77'); oval(ctx, 27, 0, 2, 3, '#171717', null);
    ctx.beginPath(); ctx.moveTo(26,6); ctx.lineTo(31,6); ctx.stroke();
  }
  // A tiny school satchel is shared by both characters.
  ctx.fillStyle = '#f5b557'; ctx.fillRect(-12, 4, 9, 11); ctx.strokeStyle = '#422b20'; ctx.strokeRect(-12,4,9,11);
  ctx.restore();
}

export function renderPolynomialGame(main, backend = null) {
  let record = cleanRecord(null), storageOK = true;
  try { if (backend) record = cleanRecord(backend.initialRecord); else { const raw = localStorage.getItem(STORAGE_KEY); if (raw && raw.length <= 4096) record = cleanRecord(JSON.parse(raw)); } }
  catch { storageOK = false; }
  let character = 'squirrel', stageIndex = 0, mode = 'adventure', run = null, frame = 0, last = 0, accumulator = 0, disposed = false;
  const held = new Set(), touch = new Map(), events = new AbortController();
  const on = (el, type, handler, options = {}) => el.addEventListener(type, handler, { ...options, signal: events.signal });
  main.innerHTML = `<section class="forest-page">
    <a class="back-link" href="https://taehwan-shin.github.io/classroom-hub/">← 도구함으로</a>
    <header class="forest-heading"><div><p class="eyebrow">고등학교 1학년 · 공통수학1</p><h1 tabindex="-1">다항식 <span class="marker-line">숲 탐험</span></h1><p>한 걸음씩 풀고, 한 뼘씩 성장하는 수학 모험.</p></div><span class="forest-wordmark" aria-hidden="true">POLYNOMIAL<br>FOREST / 01</span></header>
    <div class="forest-lobby">
      <div class="forest-cover"><canvas class="forest-cover-canvas" width="960" height="420" role="img" aria-label="다람쥐와 거북이가 함께 떠나는 숲속 수학 모험"></canvas><div class="forest-cover-caption"><span>작은 친구들의 커다란 도전</span><strong>오늘의 모험가를<br>골라주세요.</strong><p>다항식의 숲 끝에서 만나요.</p></div></div>
      <div class="forest-setup">
        <fieldset class="forest-character"><legend>01 / 함께할 친구</legend><div class="forest-character-grid">
          <label><input type="radio" name="forest-character" value="squirrel" checked><span><canvas width="110" height="85" class="avatar-squirrel" aria-hidden="true"></canvas><strong>다람쥐</strong><small>도토리 수집가</small></span></label>
          <label><input type="radio" name="forest-character" value="turtle"><span><canvas width="110" height="85" class="avatar-turtle" aria-hidden="true"></canvas><strong>거북이</strong><small>차근차근 탐험가</small></span></label>
        </div><p class="forest-fine">두 친구의 이동 속도와 점프 높이는 같아요.</p></fieldset>
        <fieldset class="forest-stages"><legend>02 / 탐험할 길</legend><div class="forest-stage-options"></div></fieldset>
        <fieldset class="forest-modes"><legend>03 / 진행 방식</legend><label><input type="radio" name="forest-mode" value="adventure" checked> 직접 이동·점프</label><label><input type="radio" name="forest-mode" value="quiz"> 자동 이동·퀴즈 집중</label></fieldset>
        <button class="forest-start primary-button">숲으로 출발하기 <span aria-hidden="true">↗</span></button>
      </div>
    </div>
    <section class="forest-play" hidden aria-label="게임 화면">
      <div class="forest-hud"><strong class="forest-run-label"></strong><span class="forest-score"></span><span class="forest-progress"></span><button class="forest-pause">일시정지</button><button class="forest-exit">선택 화면</button></div>
      <canvas class="forest-canvas" width="960" height="420" tabindex="0" aria-label="숲 탐험 게임. 방향키 또는 A와 D로 이동, 스페이스 또는 위쪽 방향키로 점프. P로 일시정지."></canvas>
      <p class="forest-message" role="status" aria-live="polite"></p>
      <div class="forest-touch" aria-label="터치 조작"><button data-control="left" aria-label="왼쪽 이동">←</button><button data-control="right" aria-label="오른쪽 이동">→</button><button data-control="jump">점프 ↑</button></div>
      <p class="forest-help">← → / A D 이동 · 스페이스 / ↑ 점프 · P 일시정지<br>물음표에 닿으면 퀴즈가 열립니다. 도토리 +10점 · 정답 +100점 · 장애물 충돌 −20점(0점 미만으로 내려가지 않음).</p>
    </section>
    <section class="forest-results" hidden aria-labelledby="forest-result-heading"><p class="eyebrow">오늘의 탐험 기록</p><h2 id="forest-result-heading" tabindex="-1">숲길 완주!</h2><p class="forest-result-score"></p><p class="forest-result-copy"></p><div class="forest-earned"></div><div class="forest-result-buttons"><button class="forest-retry primary-button">한 번 더 탐험</button><button class="forest-select">다른 길·친구 선택</button></div><h3>문제 돌아보기</h3><div class="forest-review"></div></section>
    <section class="forest-collection" aria-labelledby="forest-collection-title"><div class="section-heading"><h2 id="forest-collection-title">나의 뱃지 노트</h2><span class="forest-badge-count"></span></div><div class="forest-badges"></div><p class="forest-storage"></p><button class="forest-reset">이 게임 기록 지우기</button><p class="forest-reset-notice" role="status"></p></section>
    <details class="forest-instructions"><summary>학습 방법과 기록 안내</summary><p>각 길에 직접 만든 4지선다 6문제, 총 18문제가 있습니다. 문제 중에는 이동과 시간이 멈추며, 답을 한 번 고른 뒤 정답과 해설을 확인합니다. 틀려도 계속 탐험할 수 있습니다. 장애물에 부딪히면 직전 문제 뒤로 돌아옵니다.</p><p>퀴즈 집중 모드는 자동으로 이동하고 장애물 충돌을 생략합니다. 이 모드에서도 완주·정답·친구 뱃지를 얻지만 점프의 달인 뱃지는 직접 탐험으로만 얻습니다. 이름·학교·학번은 입력받지 않습니다. 최고점·뱃지·완주 캐릭터만 이 브라우저에 남으며 다른 기기와 공유되지 않습니다. 데이터 삭제·시크릿 창에서는 기록이 사라질 수 있습니다.</p></details>
    <dialog class="forest-quiz" aria-labelledby="forest-question-title"><p class="forest-question-kicker"></p><h2 id="forest-question-title" tabindex="-1"></h2><div class="forest-answers"></div><div class="forest-feedback" role="status"></div><button class="forest-continue primary-button" hidden>해설 확인 · 계속 탐험 →</button><p class="forest-fine">문제를 푸는 동안 게임은 멈춰 있어요.</p></dialog>
  </section>`;
  const $ = selector => main.querySelector(selector);
  const lobby = $('.forest-lobby'), play = $('.forest-play'), result = $('.forest-results'), dialog = $('.forest-quiz');
  const canvas = $('.forest-canvas'), ctx = canvas.getContext('2d');
  let responses = [], resetPending = false, saving = false;
  const pending = [];
  const sync = document.createElement('div'); sync.className = 'forest-sync';
  const syncMessage = document.createElement('p'); syncMessage.setAttribute('role', 'status');
  const retry = document.createElement('button'); retry.textContent = '저장 다시 시도'; retry.hidden = true;
  sync.append(syncMessage, retry); $('.forest-collection').append(sync);
  const history = document.createElement('section'); history.className = 'forest-history';
  if (backend) {
    const info = $('.forest-instructions');
    info.lastElementChild.textContent = '완주한 길·캐릭터·진행 방식·점수·선택한 답을 내 계정에 저장합니다. 저장 성공 여부를 확인하세요. 로그인 전 기기 기록은 자동 이전하지 않습니다. 공개 순위나 공식 평가에 사용하지 않습니다.';
    $('.back-link').href = 'https://taehwan-shin.github.io/classroom-hub/';
    $('.forest-collection').append(history);
  }
  function showHistory(rows) {
    history.replaceChildren();
    const title = document.createElement('h3'); title.textContent = '최근 학습 기록 (최대 20회)'; history.append(title);
    const list = document.createElement('ul');
    for (const row of rows) {
      const item = document.createElement('li');
      const date = new Date(row.created_at);
      item.textContent = `${Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('ko-KR')} · ${stages.find(s => s.id === row.stage)?.name || '숲길'} · ${row.character === 'squirrel' ? '다람쥐' : '거북이'} · ${row.score}점 · ${row.correct_count}/6 정답`;
      list.append(item);
    }
    history.append(list); if (!rows.length) { const empty = document.createElement('p'); empty.textContent = '아직 저장한 완주 기록이 없어요.'; history.append(empty); }
  }
  if (backend) showHistory(backend.history || []);
  async function flush() {
    if (!backend || saving || disposed || !pending.length) return;
    saving = true; retry.hidden = true; $('.forest-reset').disabled = true;
    syncMessage.textContent = '학습 기록을 저장하고 있어요…';
    try {
      while (pending.length && !disposed) { await backend.complete(pending[0]); pending.shift(); }
      const fresh = await backend.load();
      if (!disposed) { record = fresh.record; collection(); showHistory(fresh.history); syncMessage.textContent = '내 계정에 학습 기록을 저장했어요.'; }
    } catch { if (!disposed) { syncMessage.textContent = '기록을 저장하거나 확인하지 못했어요. 이 화면을 유지하고 다시 시도해주세요.'; retry.hidden = false; } }
    finally { saving = false; if (!disposed) $('.forest-reset').disabled = pending.length > 0; }
  }
  on(retry, 'click', () => {
    // A successful insert followed by a failed refresh is safe to retry.
    if (!pending.length) { pending.push(backend.lastCompletion); }
    void flush();
  });
  const stageOptions = $('.forest-stage-options');
  stages.forEach((s, i) => {
    const label = document.createElement('label'), input = document.createElement('input'), span = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small');
    input.type = 'radio'; input.name = 'forest-stage'; input.value = String(i); input.checked = i === 0;
    title.textContent = `${i+1}. ${s.name}`; subtitle.textContent = s.subtitle;
    span.append(title, subtitle); label.append(input, span); stageOptions.append(label);
  });
  for (const [selector, c] of [['.avatar-squirrel', 'squirrel'], ['.avatar-turtle', 'turtle']]) {
    const context = $(selector).getContext('2d'); context.scale(1.5,1.5); drawCharacter(context,c,22,10);
  }
  function save() {
    if (backend) {
      const attempt = backend.makeCompletion(run, responses); backend.lastCompletion = attempt; pending.push(attempt); void flush(); return;
    }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(record)); storageOK = true; }
    catch { storageOK = false; }
  }
  function collection() {
    $('.forest-badge-count').textContent = `${record.badges.length} / ${badges.length}`;
    $('.forest-badges').replaceChildren();
    badges.forEach((b, i) => {
      const item = document.createElement('div'), icon = document.createElement('span'), title = document.createElement('strong'), rule = document.createElement('small');
      const earned = record.badges.includes(b.id); item.className = `forest-badge ${earned ? 'earned' : ''}`;
      icon.textContent = ['✦','◇','△','✓','↑','♡'][i]; icon.setAttribute('aria-hidden','true');
      title.textContent = b.name; rule.textContent = `${earned ? '획득 · ' : '미획득 · '}${b.rule}`; item.append(icon,title,rule); $('.forest-badges').append(item);
    });
    $('.forest-storage').textContent = backend ? `내 계정 기록 · 길별 최고점 ${stages.map(s => `${s.name} ${record.best[s.id]}점`).join(' / ')}` : storageOK ? `이 기기에만 저장 · 길별 최고점 ${stages.map(s => `${s.name} ${record.best[s.id]}점`).join(' / ')}` : '브라우저 저장을 사용할 수 없어 현재 화면에서만 기록을 유지합니다. 새로고침하면 사라집니다.';
  }
  function clearControls() { held.clear(); touch.clear(); }
  function notice(text) { $('.forest-message').textContent = text; }
  function hud() {
    $('.forest-score').textContent = `${run.score}점`;
    $('.forest-progress').textContent = `문제 ${run.next}/6 · 충돌 ${run.hits}회`;
  }
  function background(context, camera, cover = false) {
    context.fillStyle = '#f3e9d6'; context.fillRect(0,0,WIDTH,HEIGHT);
    oval(context,790-camera*.04,75,42,42,'#f6bc69',null);
    context.fillStyle = '#d6d6b4'; context.beginPath(); context.moveTo(0,300);
    for (let x=0;x<=WIDTH+80;x+=80) context.lineTo(x,220+Math.sin((x+camera*.12)/180)*48);
    context.lineTo(WIDTH,HEIGHT); context.lineTo(0,HEIGHT); context.fill();
    for (let i=-1;i<9;i++) {
      const x=i*170-(camera*.32%170), height=110+(i%3)*25;
      context.fillStyle='#9f8464'; context.fillRect(x+40,GROUND-height,13,height);
      oval(context,x+45,GROUND-height-10,50,62,'#b1b28a',null);
      oval(context,x+30,GROUND-height-28,35,46,'#c0c19a',null);
    }
    context.fillStyle='#6d7854'; context.fillRect(0,GROUND,WIDTH,8);
    context.fillStyle='#c7ab86'; context.fillRect(0,GROUND+8,WIDTH,HEIGHT-GROUND-8);
    context.fillStyle='#af916b'; for(let x=0;x<WIDTH;x+=34) context.fillRect(x-(camera%34),GROUND+27,12,3);
    if (cover) { drawCharacter(context,'squirrel',675,GROUND-48,1); drawCharacter(context,'turtle',790,GROUND-48,-1); }
  }
  const coverCtx = $('.forest-cover-canvas').getContext('2d'); background(coverCtx,0,true);
  function draw() {
    if (!run || !ctx) return;
    const camera = Math.max(0,Math.min(FINISH-WIDTH+220,run.x-260)); background(ctx,camera);
    ctx.font = 'bold 20px "Malgun Gothic", sans-serif';
    for(const p of platforms) { ctx.fillStyle='#6d7854'; ctx.fillRect(p.x-camera,p.y,p.w,9); ctx.fillStyle='#bda485'; ctx.fillRect(p.x-camera,p.y+9,p.w,12); }
    for(const x of logs) { ctx.fillStyle='#8b6040'; ctx.fillRect(x-camera,GROUND-30,42,30); oval(ctx,x-camera+21,GROUND-16,15,12,'#c09561'); ctx.fillStyle='#422b20'; ctx.font='15px sans-serif'; ctx.fillText('!',x-camera+18,GROUND-11); }
    for(let i=0;i<12;i++) if(!run.collected.has(i)) { const x=300+i*270-camera,y=i%2?212:307; oval(ctx,x,y,9,11,'#d09a43'); ctx.fillStyle='#674c2f'; ctx.fillRect(x-10,y-10,20,5); }
    gates.forEach((x,i)=> { ctx.fillStyle= i<run.next?'#7a8050':'#c9652e'; ctx.fillRect(x-camera,GROUND-82,4,82); ctx.fillRect(x-camera-18,GROUND-90,40,36); ctx.fillStyle='#fff9ed'; ctx.font='bold 23px sans-serif'; ctx.fillText(i<run.next?'✓':'?',x-camera-6,GROUND-64); });
    ctx.fillStyle='#614c36'; ctx.fillRect(FINISH-camera,GROUND-110,8,110); ctx.fillStyle='#e78343'; ctx.fillRect(FINISH-camera+8,GROUND-110,100,45); ctx.fillStyle='#2b1a07'; ctx.font='bold 18px sans-serif'; ctx.fillText('FINISH',FINISH-camera+17,GROUND-81);
    drawCharacter(ctx,run.character,run.x-camera,run.y,run.facing,run.grounded && (held.size || touch.size || run.mode==='quiz') ? run.x/12 : 0);
    if(run.state==='paused') { ctx.fillStyle='rgba(253,251,249,.8)'; ctx.fillRect(0,0,WIDTH,HEIGHT); ctx.fillStyle='#2b1a07'; ctx.font='bold 32px sans-serif'; ctx.textAlign='center'; ctx.fillText('잠깐 쉬어가요',WIDTH/2,HEIGHT/2); ctx.textAlign='left'; }
  }
  function direction() {
    const left=held.has('ArrowLeft')||held.has('KeyA')||[...touch.values()].includes('left');
    const right=held.has('ArrowRight')||held.has('KeyD')||[...touch.values()].includes('right');
    return Number(right)-Number(left);
  }
  function question() {
    clearControls(); const q=stages[stageIndex].questions[run.next];
    $('.forest-question-kicker').textContent = `${stages[stageIndex].name} · ${run.next+1} / 6`;
    $('#forest-question-title').textContent = q.prompt;
    $('.forest-answers').replaceChildren(); $('.forest-feedback').textContent=''; $('.forest-continue').hidden=true;
    q.choices.forEach((choice,i)=> {
      const button=document.createElement('button'); button.textContent=`${i+1}. ${choice}`;
      on(button,'click',()=> {
        const correct=answer(run,i,q.answer); if(correct===null) return;
        responses.push({ index:run.next, choice:i, correct });
        for(const [j,b] of [...$('.forest-answers').children].entries()) { b.disabled=true; if(j===q.answer) b.classList.add('correct-answer'); if(j===i&&!correct) b.classList.add('wrong-answer'); }
        $('.forest-feedback').textContent=`${correct?'정답! +100점':'다시 배워볼까요? 정답은 '+(q.answer+1)+'번입니다.'} ${q.explanation}`;
        $('.forest-continue').hidden=false; $('.forest-continue').focus(); hud();
      });
      $('.forest-answers').append(button);
    });
    dialog.showModal(); $('#forest-question-title').focus();
  }
  function finish() {
    clearControls(); const before=new Set(record.badges);
    record=completeRecord(record,run); save(); collection(); play.hidden=true; result.hidden=false;
    $('.forest-result-score').textContent=`${run.score}점 · 정답 ${run.correct}/6 · 도토리 ${run.collected.size}개`;
    $('.forest-result-copy').textContent=`${run.character==='squirrel'?'다람쥐':'거북이'}와 ${stages[stageIndex].name} 완주! 최고 ${record.best[run.stage]}점. 틀린 문제의 해설도 다시 확인하세요.`;
    const earned=record.badges.filter(b=>!before.has(b)); $('.forest-earned').textContent=earned.length?`새 뱃지: ${badges.filter(b=>earned.includes(b.id)).map(b=>b.name).join(' · ')}`:'이미 모은 뱃지도 계속 간직해요.';
    $('.forest-review').replaceChildren();
    responses.forEach(response=> {
      const q=stages[stageIndex].questions[response.index], details=document.createElement('details'), summary=document.createElement('summary'), p=document.createElement('p');
      summary.textContent=`${response.correct?'✓ 정답':'○ 복습'} · ${response.index+1}. ${q.prompt}`;
      p.textContent=`내 답: ${q.choices[response.choice]} / 정답: ${q.choices[q.answer]}. ${q.explanation}`;
      details.append(summary,p); $('.forest-review').append(details);
    });
    $('#forest-result-heading').focus();
  }
  function loop(now) {
    if(disposed) return;
    if(run?.state==='running') {
      accumulator += last ? Math.min((now-last)/1000,.05) : 0;
      while(accumulator>=1/120 && run.state==='running') {
        const event=advance(run,1/120,direction()); accumulator-=1/120;
        if(event==='hit') notice('나무에 부딪혔어요. −20점. 직전 문제 뒤에서 다시 점프해보세요.');
        if(event==='question') question();
        if(event==='finished') finish();
      }
      hud();
    } else accumulator=0;
    last=now; draw(); frame=run && run.state!=='finished' ? requestAnimationFrame(loop) : 0;
  }
  function start() {
    character=$('input[name="forest-character"]:checked').value;
    stageIndex=Number($('input[name="forest-stage"]:checked').value);
    mode=$('input[name="forest-mode"]:checked').value;
    if(!stages[stageIndex]) return;
    run=createRun(character,stages[stageIndex].id,mode); responses=[]; clearControls(); last=0; accumulator=0;
    lobby.hidden=true; result.hidden=true; play.hidden=false; $('.forest-pause').textContent='일시정지';
    $('.forest-run-label').textContent=`${character==='squirrel'?'다람쥐':'거북이'} · ${stages[stageIndex].name}`;
    $('.forest-touch').hidden=mode==='quiz'; notice(mode==='quiz'?'자동으로 이동합니다. 문제를 차근차근 풀어보세요.':'오른쪽으로 출발! 나무는 점프해서 넘고 물음표에서 문제를 풀어보세요.');
    hud(); draw(); canvas.focus(); if(!frame) frame=requestAnimationFrame(loop);
  }
  function pause() {
    if(!run||!['running','paused'].includes(run.state)) return;
    run.state=run.state==='running'?'paused':'running'; clearControls(); accumulator=0; last=0;
    $('.forest-pause').textContent=run.state==='paused'?'계속하기':'일시정지'; notice(run.state==='paused'?'일시정지 중입니다. 계속하기 또는 P를 눌러주세요.':'탐험을 계속합니다.'); draw();
  }
  function select() { clearControls(); cancelAnimationFrame(frame); frame=0; if(dialog.open) dialog.close(); run=null; lobby.hidden=false; play.hidden=true; result.hidden=true; $('.forest-start').focus(); }
  on($('.forest-start'),'click',start); on($('.forest-retry'),'click',start); on($('.forest-pause'),'click',()=>{pause();canvas.focus();});
  on($('.forest-exit'),'click',select); on($('.forest-select'),'click',select);
  on($('.forest-continue'),'click',()=> { if(continueRun(run)) { dialog.close(); clearControls(); last=0; accumulator=0; notice('해설을 확인했어요. 다음 물음표로 이동하세요.'); canvas.focus(); hud(); } });
  on(dialog,'cancel',event=>{event.preventDefault();});
  on(document,'visibilitychange',()=> { if(document.hidden) { clearControls(); if(run?.state==='running') pause(); } });
  on(window,'blur',()=> { clearControls(); if(run?.state==='running') pause(); });
  on(canvas,'keydown',event=> {
    if(!run||!['running','paused'].includes(run.state)) return;
    if(['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW','KeyP'].includes(event.code)) event.preventDefault();
    if(event.code==='KeyP'&&!event.repeat) { pause(); return; }
    if(run.state!=='running') return;
    if(['ArrowUp','Space','KeyW'].includes(event.code)&&!event.repeat) jump(run);
    if(['ArrowLeft','ArrowRight','KeyA','KeyD'].includes(event.code)) held.add(event.code);
  });
  on(window,'keyup',event=>{held.delete(event.code);}); on(canvas,'blur',clearControls);
  for(const button of main.querySelectorAll('[data-control]')) {
    on(button,'pointerdown',event=> { if(event.button!==0||run?.state!=='running') return; event.preventDefault(); button.setPointerCapture(event.pointerId); if(button.dataset.control==='jump') jump(run); else touch.set(event.pointerId,button.dataset.control); });
    for(const type of ['pointerup','pointercancel','lostpointercapture']) on(button,type,event=>{touch.delete(event.pointerId);});
    // Keyboard and assistive technology can activate jump without a pointer.
    on(button,'click',event=>{if(event.detail===0&&button.dataset.control==='jump'&&run) jump(run);});
  }
  on($('.forest-reset'),'click',async ()=> {
    if (saving || pending.length) return;
    if (run && run.state !== 'finished') { $('.forest-reset-notice').textContent = '먼저 탐험을 마치거나 선택 화면으로 돌아가주세요.'; return; }
    if(!resetPending) { resetPending=true; $('.forest-reset').textContent='확인: 이 게임 기록만 삭제'; $('.forest-reset-notice').textContent='최고점·뱃지·완주 캐릭터가 삭제됩니다. 다시 누르면 삭제합니다.'; return; }
    $('.forest-reset').disabled = true;
    $('.forest-start').disabled = true; $('.forest-retry').disabled = true;
    try { if (backend) { await backend.reset(); if (disposed) return; showHistory([]); } else localStorage.removeItem(STORAGE_KEY); record=cleanRecord(null); resetPending=false; $('.forest-reset').textContent='이 게임 기록 지우기'; $('.forest-reset-notice').textContent='이 게임의 저장 기록을 삭제했습니다.'; syncMessage.textContent = ''; collection(); }
    catch { if (!disposed) $('.forest-reset-notice').textContent='기록을 삭제하지 못했습니다. 연결과 로그인 상태를 확인한 뒤 다시 시도해주세요.'; }
    finally { if (!disposed) { $('.forest-reset').disabled = false; $('.forest-start').disabled = false; $('.forest-retry').disabled = false; } }
  });
  collection();
  return ()=> { disposed=true; cancelAnimationFrame(frame); clearControls(); events.abort(); if(dialog.open) dialog.close(); };
}
