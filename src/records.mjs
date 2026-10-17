import { stages, cleanRecord, completeRecord } from './polynomial-data.mjs';

export function completion(run, responses, attemptId = crypto.randomUUID()) {
  if (run.state !== 'finished' || responses.length !== 6 || !['adventure', 'quiz'].includes(run.mode)) throw new Error('Incomplete run');
  completeRecord(null, run);
  const stage = stages.find(s => s.id === run.stage);
  const answers = responses.map((r, i) => {
    if (r.index !== i || !Number.isInteger(r.choice) || r.choice < 0 || r.choice > 3) throw new Error('Invalid answers');
    return r.choice;
  });
  const correct = answers.filter((a, i) => a === stage.questions[i].answer).length;
  if (correct !== run.correct || !/^[0-9a-f-]{36}$/i.test(attemptId) || run.hits > 100000 || run.collected.size > 12) throw new Error('Invalid run');
  return Object.freeze({ attempt_id: attemptId, stage: run.stage, character: run.character, mode: run.mode,
    score: run.score, correct_count: correct, hits: run.hits, acorns: run.collected.size, answers: Object.freeze(answers) });
}
export function recordFromAttempts(rows) {
  let record = cleanRecord(null);
  for (const row of rows) record = completeRecord(record, { ...row, correct: row.correct_count });
  return record;
}
