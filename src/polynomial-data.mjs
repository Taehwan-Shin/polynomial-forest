// Original questions, not copied from the reference game or a textbook.
const q = (prompt, choices, answer, explanation) => Object.freeze({ prompt, choices: Object.freeze(choices), answer, explanation });
export const stages = Object.freeze([
  { id: 'operations', name: '연산의 오솔길', subtitle: '다항식의 덧셈·뺄셈·곱셈·나눗셈', badge: '연산 탐험가', questions: [
    q('(2x² − 3x + 1) + (x² + 5x − 4)를 정리하면?', ['3x² + 2x − 3', '3x² − 8x − 3', '2x² + 2x − 3', '3x² + 2x + 5'], 0, '같은 차수의 항끼리 더합니다. (2+1)x² + (−3+5)x + (1−4) = 3x² + 2x − 3.'),
    q('(3x² + 2x − 1) − (x² − 4x + 3)을 정리하면?', ['2x² − 2x + 2', '2x² + 6x − 4', '4x² − 2x + 2', '2x² + 6x + 2'], 1, '빼는 식의 모든 부호를 바꿉니다. 3x² + 2x − 1 − x² + 4x − 3 = 2x² + 6x − 4.'),
    q('(x + 3)(x − 2)를 전개하면?', ['x² − x − 6', 'x² + x + 6', 'x² + x − 6', 'x² + 5x − 6'], 2, '분배법칙으로 x² − 2x + 3x − 6 = x² + x − 6.'),
    q('(2x − 1)²을 전개하면?', ['4x² − 1', '4x² − 2x + 1', '2x² − 4x + 1', '4x² − 4x + 1'], 3, '(a−b)² = a²−2ab+b²에 a=2x, b=1을 대입합니다.'),
    q('(x + 2)(x² − 2x + 4)를 전개하면?', ['x³ + 8', 'x³ − 8', 'x³ + 4x + 8', 'x³ + 2x² + 8'], 0, '(a+b)(a²−ab+b²) = a³+b³이므로 x³+2³ = x³+8.'),
    q('x² + 3x + 2를 x + 1로 나눈 몫과 나머지는?', ['몫 x+1, 나머지 1', '몫 x+2, 나머지 0', '몫 x+3, 나머지 2', '몫 x+2, 나머지 2'], 1, '(x+1)(x+2) = x²+3x+2이므로 몫은 x+2, 나머지는 0입니다.')
  ] },
  { id: 'remainder', name: '나머지의 다리', subtitle: '항등식 · 나머지정리 · 인수정리', badge: '나머지 해결사', questions: [
    q('모든 실수 x에 대해 ax² + bx + c = 2x² − 3x + 4일 때 a+b+c는?', ['9', '−5', '3', '1'], 2, '항등식의 계수를 비교하면 a=2, b=−3, c=4입니다. 합은 3입니다.'),
    q('P(x)=x³ − 2x + 5를 x−2로 나눈 나머지는?', ['5', '7', '8', '9'], 3, '나머지정리에 따라 P(2) = 8−4+5 = 9입니다.'),
    q('P(x)=2x² + 3x − 1을 x+1로 나눈 나머지는?', ['−2', '0', '2', '4'], 0, 'x+1 = x−(−1)이므로 P(−1) = 2−3−1 = −2입니다.'),
    q('x² + kx + 6이 x−2로 나누어떨어질 때 k는?', ['5', '−5', '−3', '3'], 1, '인수정리에 따라 P(2)=0입니다. 4+2k+6=0이므로 k=−5.'),
    q('P(x)를 x−3으로 나눈 나머지가 7일 때 P(3)은?', ['3', '4', '7', '10'], 2, '나머지정리는 x−a로 나눈 나머지가 P(a)라는 뜻입니다. 따라서 P(3)=7.'),
    q('P(x)=x³ − 4x의 인수가 아닌 것은?', ['x', 'x−2', 'x+2', 'x−1'], 3, 'P(x)=x(x²−4)=x(x−2)(x+2)입니다. P(1)=−3≠0이므로 x−1은 인수가 아닙니다.')
  ] },
  { id: 'factor', name: '인수분해의 정상', subtitle: '공통인수 · 곱셈공식 · 세제곱식', badge: '인수분해 마스터', questions: [
    q('x² − 9를 인수분해하면?', ['(x−3)(x+3)', '(x−3)²', '(x−9)(x+1)', '(x+3)²'], 0, '제곱의 차 a²−b² = (a−b)(a+b)를 이용합니다.'),
    q('x² + 5x + 6을 인수분해하면?', ['(x−2)(x−3)', '(x+2)(x+3)', '(x+1)(x+6)', '(x−1)(x−6)'], 1, '합이 5, 곱이 6인 두 수는 2와 3입니다.'),
    q('2x² + 7x + 3을 인수분해하면?', ['(2x+3)(x+1)', '(2x−1)(x−3)', '(2x+1)(x+3)', '(2x+3)(x+3)'], 2, '(2x+1)(x+3) = 2x²+6x+x+3 = 2x²+7x+3.'),
    q('x³ − 8을 인수분해하면?', ['(x−2)(x²−2x+4)', '(x+2)(x²−2x+4)', '(x−2)³', '(x−2)(x²+2x+4)'], 3, 'a³−b³ = (a−b)(a²+ab+b²)에 a=x, b=2를 대입합니다.'),
    q('x³ + 3x² + 3x + 1을 인수분해하면?', ['(x+1)³', '(x−1)³', '(x+3)(x²+1)', '(x+1)(x²+3)'], 0, '(a+b)³ = a³+3a²b+3ab²+b³입니다. b=1이면 (x+1)³.'),
    q('x³ − x를 인수분해하면?', ['x(x−1)²', 'x(x−1)(x+1)', '(x−1)(x²+1)', 'x(x+1)²'], 1, '먼저 공통인수 x를 묶고 제곱의 차를 적용합니다. x(x²−1)=x(x−1)(x+1).')
  ] }
].map(s => Object.freeze({ ...s, questions: Object.freeze(s.questions) })));

export const badges = Object.freeze([
  ...stages.map(s => ({ id: s.id, name: s.badge, rule: `${s.name} 완주` })),
  { id: 'scholar', name: '정확한 수학자', rule: '한 스테이지에서 6문제 모두 정답' },
  { id: 'explorer', name: '점프의 달인', rule: '모험 모드에서 장애물에 부딪히지 않고 완주' },
  { id: 'friends', name: '숲속 두 친구', rule: '다람쥐와 거북이로 각각 한 번 이상 완주' }
]);
export const STORAGE_KEY = 'classroom-polynomial-v1';
export function cleanRecord(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    best: Object.fromEntries(stages.map(s => [s.id, Number.isInteger(source.best?.[s.id]) && source.best[s.id] >= 0 && source.best[s.id] <= 1000 ? source.best[s.id] : 0])),
    badges: badges.filter(b => Array.isArray(source.badges) && source.badges.includes(b.id)).map(b => b.id),
    characters: ['squirrel', 'turtle'].filter(c => Array.isArray(source.characters) && source.characters.includes(c))
  };
}
export function completeRecord(record, run) {
  const next = cleanRecord(record);
  if (!stages.some(s => s.id === run.stage) || !['squirrel', 'turtle'].includes(run.character) ||
      !Number.isInteger(run.score) || run.score < 0 || run.score > 1000 ||
      !Number.isInteger(run.correct) || run.correct < 0 || run.correct > 6 || !Number.isInteger(run.hits) || run.hits < 0) throw new Error('Invalid completion');
  next.best[run.stage] = Math.max(next.best[run.stage], run.score);
  next.characters = [...new Set([...next.characters, run.character])];
  const earned = [run.stage];
  if (run.correct === 6) earned.push('scholar');
  if (run.hits === 0 && run.mode === 'adventure') earned.push('explorer');
  if (next.characters.length === 2) earned.push('friends');
  next.badges = [...new Set([...next.badges, ...earned])];
  return next;
}
