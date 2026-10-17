import test from 'node:test';
import assert from 'node:assert/strict';
import { completion, recordFromAttempts } from '../src/records.mjs';
import { createRun } from '../src/polynomial-engine.mjs';
import { stages } from '../src/polynomial-data.mjs';

function finished(stage = stages[0], character = 'squirrel') { return { ...createRun(character, stage.id, 'quiz'), state:'finished', score:600,correct:6 }; }
const answers = stage => stage.questions.map((q,index)=>({index,choice:q.answer}));
test('completion snapshots answers, creates idempotency ID and rejects unfinished or mismatched work', () => {
  const run = finished(), responses = answers(stages[0]), a = completion(run,responses);
  assert.equal(a.correct_count,6); assert.equal(a.answers.length,6); assert.ok(Object.isFrozen(a)); assert.ok(Object.isFrozen(a.answers));
  responses[0].choice=3; assert.equal(a.answers[0],0);
  assert.throws(()=>completion({...run,state:'running'},answers(stages[0])));
  assert.throws(()=>completion(run,responses)); assert.throws(()=>completion(run,answers(stages[0]).slice(1)));
  assert.throws(()=>completion({...run,hits:100001},answers(stages[0])));
});
test('account summary is independent of ordering and preserves best scores and both characters', () => {
  const a = completion(finished(),answers(stages[0]));
  const b = completion(finished(stages[1],'turtle'),answers(stages[1]));
  const one=recordFromAttempts([a,b]),two=recordFromAttempts([b,a,a]);
  assert.deepEqual(one.best,two.best); assert.deepEqual(new Set(one.badges),new Set(two.badges));
  assert.ok(one.badges.includes('friends')); assert.ok(one.badges.includes('scholar')); assert.ok(!one.badges.includes('explorer'));
  assert.equal(recordFromAttempts([]).best.operations,0);
});
