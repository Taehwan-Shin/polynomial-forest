export const WIDTH = 960, HEIGHT = 420, GROUND = 344, FINISH = 3650;
export const gates = Object.freeze([540, 1080, 1620, 2160, 2700, 3240]);
export const logs = Object.freeze([820, 1360, 1900, 2440, 2980, 3500]);
export const platforms = Object.freeze([720, 1260, 1800, 2340, 2880].map(x => ({ x, y: 258, w: 130 })));
export function createRun(character, stage, mode = 'adventure') {
  if (!['squirrel', 'turtle'].includes(character) || !['operations', 'remainder', 'factor'].includes(stage) || !['adventure', 'quiz'].includes(mode)) throw new Error('Invalid game setup');
  return { character, stage, mode, x: 90, y: GROUND - 48, vy: 0, grounded: true, score: 0, correct: 0, hits: 0, next: 0, state: 'running', collected: new Set(), answered: false, facing: 1 };
}
export function jump(run) {
  if (run.state === 'running' && run.grounded) { run.vy = -620; run.grounded = false; }
}
export function advance(run, dt, direction) {
  if (run.state !== 'running' || !Number.isFinite(dt) || dt <= 0) return null;
  dt = Math.min(dt, 1 / 60);
  direction = [-1, 0, 1].includes(direction) ? direction : 0;
  if (run.mode === 'quiz') direction = 1;
  if (direction) run.facing = direction;
  run.x = Math.max(24, Math.min(FINISH, run.x + direction * 260 * dt));
  const oldBottom = run.y + 48;
  run.vy += 1550 * dt; run.y += run.vy * dt; run.grounded = false;
  let landing = GROUND;
  for (const p of platforms) if (run.x + 30 > p.x && run.x < p.x + p.w && oldBottom <= p.y + 1 && run.y + 48 >= p.y && run.vy >= 0) landing = Math.min(landing, p.y);
  if (run.y + 48 >= landing && run.vy >= 0) { run.y = landing - 48; run.vy = 0; run.grounded = true; }
  if (run.mode === 'adventure') {
    for (const x of logs) if (run.x + 29 > x && run.x < x + 42 && run.y + 48 > GROUND - 31) {
      run.hits++; run.score = Math.max(0, run.score - 20);
      run.x = run.next ? gates[run.next - 1] + 60 : 90; run.y = GROUND - 48; run.vy = 0; run.grounded = true;
      return 'hit';
    }
    for (let i = 0; i < 12; i++) {
      const x = 300 + i * 270, y = i % 2 ? 212 : 307;
      if (!run.collected.has(i) && Math.hypot(run.x + 16 - x, run.y + 24 - y) < 36) { run.collected.add(i); run.score += 10; }
    }
  }
  if (run.next < gates.length && run.x >= gates[run.next] - 32) { run.state = 'question'; run.answered = false; return 'question'; }
  if (run.x >= FINISH && run.next === gates.length) { run.state = 'finished'; return 'finished'; }
  return null;
}
export function answer(run, choice, correctChoice) {
  if (run.state !== 'question' || run.answered || !Number.isInteger(choice) || choice < 0 || choice > 3 || !Number.isInteger(correctChoice) || correctChoice < 0 || correctChoice > 3) return null;
  run.answered = true;
  const correct = choice === correctChoice;
  if (correct) { run.correct++; run.score += 100; }
  return correct;
}
export function continueRun(run) {
  if (run.state !== 'question' || !run.answered) return false;
  run.next++; run.x = gates[run.next - 1] + 60; run.state = 'running'; return true;
}
