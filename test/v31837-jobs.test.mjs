// v318.37 (Fable X2-3): JOBS times the jobs waiting one after another; a job that answers early no longer pads the
// timing of the ones behind it, nor of later jobs (retime, 03-jobs). On v318.36 the deadline tail kept every budget
// ever posted while any job waited: a Sensitivity drag's superseded seg jobs left the last one due many budgets out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './harness.mjs';

// an app whose worker only answers when told to (answer): as test/v307-final
function withWorker() {
  const made = [];
  class FakeWorker {
    constructor() {
      this.sent = [];
      this.stopped = false;
      made.push(this);
    }
    postMessage(m) {
      this.sent.push(m);
    }
    terminate() {
      this.stopped = true;
    }
    answer(id, r) {
      this.onmessage({ data: { id, r } });
    }
    drop(id) {
      this.onmessage({ data: { id, err: 'superseded' } });
    }
  }
  const app = createApp({
    Worker: FakeWorker,
    URL: { createObjectURL: () => 'blob:jobs' },
    Blob: function () {},
    setTimeout,
    clearTimeout,
  });
  return { jobs: app.__mstest.jobs, made };
}
const settle = (p) =>
  p.then(
    (v) => ({ ok: true, v }),
    (e) => ({ ok: false, why: e.message }),
  );
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const n = (o) => JSON.parse(JSON.stringify(o));

test('superseded jobs answered: the one still waiting is due its own budget after the last answer, not every budget posted', async () => {
  const { jobs, made } = withWorker();
  jobs.hang(80, 'seg');
  // (a drag: four seg jobs posted at once, due 80, 160, 240 and 320 ms out)
  const ps = [1, 2, 3, 4].map(() => settle(jobs.run('seg', { W: 1, H: 1 })));
  const wk = made[0];
  assert.equal(wk.sent.length, 4);
  await wait(10);
  // the first three answer 'superseded' at once (their next step)
  wk.drop(wk.sent[0].id);
  wk.drop(wk.sent[1].id);
  wk.drop(wk.sent[2].id);
  assert.deepEqual(n(jobs.stats.dropped), { seg: 3 });
  const t0 = Date.now();
  // the fourth is now due 80 ms after that answer (v318.36: at 320 ms, a budget for each of the three)
  assert.deepEqual(await ps[3], { ok: false, why: 'timed out' });
  const dt = Date.now() - t0;
  assert.ok(dt >= 60 && dt < 200, 'given its own budget after the last answer: ' + dt + ' ms');
  assert.deepEqual(n(jobs.stats.timedOut), { seg: 1 });
  assert.equal(wk.stopped, true);
  for (const p of ps.slice(0, 3)) assert.deepEqual(await p, { ok: false, why: 'superseded' });
});

test('a later job is timed from the jobs still waiting, not from budgets already answered', async () => {
  const { jobs, made } = withWorker();
  jobs.hang(100);
  const a = settle(jobs.run('pdf', { n: 1 })),
    b = settle(jobs.run('pdf', { n: 1 }));
  const wk = made[0];
  await wait(10);
  wk.answer(wk.sent[0].id, 1);
  assert.deepEqual(await a, { ok: true, v: 1 });
  // b is still waiting (due 100 ms after a's answer); c, posted now, is due 100 ms after b is, and once b answers
  // (at 60 ms) 100 ms after that: about 160 ms from here, not 290 (v318.36: a's budget stayed in the tail)
  const t0 = Date.now(),
    c = settle(jobs.run('pdf', { n: 1 }));
  await wait(60);
  wk.answer(wk.sent[1].id, 2);
  assert.deepEqual(await b, { ok: true, v: 2 });
  assert.deepEqual(await c, { ok: false, why: 'timed out' });
  const dt = Date.now() - t0;
  assert.ok(dt >= 130 && dt < 240, 'c due a budget after b answered: ' + dt + ' ms');
});

test('a job ahead keeps its own time when one behind it answers first', async () => {
  const { jobs, made } = withWorker();
  jobs.hang(100);
  const a = settle(jobs.run('png', { w: 1, h: 1 })),
    b = settle(jobs.run('png', { w: 1, h: 1 }));
  const wk = made[0];
  await wait(10);
  // (answers may come back in another order: b first)
  wk.answer(wk.sent[1].id, 2);
  assert.deepEqual(await b, { ok: true, v: 2 });
  await wait(50);
  assert.equal(jobs.on, true, 'a is not due yet (at 60 ms of its 100)');
  wk.answer(wk.sent[0].id, 1);
  assert.deepEqual(await a, { ok: true, v: 1 });
  await wait(120);
  assert.equal(jobs.on, true, 'nothing timed out afterwards');
  assert.deepEqual(n(jobs.stats.timedOut), {});
});
