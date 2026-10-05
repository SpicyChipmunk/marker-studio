// v307 (final): a worker job with no answer in time is given up on (the worker stopped for the session, the job done
// on the page, a late answer ignored); "That already looks white" for any white thing tapped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, app as shared } from './harness.mjs';

// an app whose worker only answers when told to (answer), and says whether it was stopped
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
  }
  const app = createApp({
    Worker: FakeWorker,
    URL: { createObjectURL: () => 'blob:jobs' },
    Blob: function () {},
    setTimeout,
    clearTimeout,
  });
  return { jobs: app.__mstest.jobs, made, app };
}
const settle = (p) =>
  p.then(
    (v) => ({ ok: true, v }),
    (e) => ({ ok: false, why: e.message }),
  );
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('a job with no answer in time: done on the page instead, the worker stopped for the session, a late answer ignored', async () => {
  const { jobs, made } = withWorker();
  assert.equal(jobs.on, true);
  jobs.hang(40);
  const a = settle(jobs.run('pdf', { n: 4 })),
    b = settle(jobs.run('png', { w: 2, h: 2 }));
  const wk = made[0];
  assert.equal(wk.sent.length, 2);
  assert.ok(
    wk.sent.every((m) => m.hang === true),
    'the test hook asks the worker to answer nothing',
  );
  // the first is due after 40 ms, the second after the first (it may wait on it): the first times out, and the worker
  // is stopped, so the second is done on the page too, at once
  const t0 = Date.now();
  assert.deepEqual(await a, { ok: false, why: 'timed out' });
  assert.ok(Date.now() - t0 >= 30, 'not before it was due');
  assert.deepEqual(await b, { ok: false, why: 'no worker' });
  assert.equal(wk.stopped, true, 'the worker is stopped');
  assert.equal(jobs.on, false, 'and not used again this session');
  assert.deepEqual(JSON.parse(JSON.stringify(jobs.stats.timedOut)), { pdf: 1 });
  // an answer arriving after all that changes nothing
  wk.answer(wk.sent[0].id, { zc: false, b: new Uint8Array(3) });
  wk.answer(wk.sent[1].id, null);
  assert.deepEqual(JSON.parse(JSON.stringify(jobs.stats.done)), {}, 'late answers aren’t counted');
  // later jobs go straight to the page: no new worker
  assert.deepEqual(await settle(jobs.run('lpts', { W: 2, H: 2 })), { ok: false, why: 'no worker' });
  assert.equal(made.length, 1);
});

test('a job answered in time isn’t timed out afterwards; jobs queued behind another are given its time too', async () => {
  const { jobs, made } = withWorker();
  jobs.hang(60);
  const a = settle(jobs.run('lmap', { w: 1, h: 1 }));
  const wk = made[0];
  await wait(20);
  wk.answer(wk.sent[0].id, 'data:image/png;base64,');
  assert.deepEqual(await a, { ok: true, v: 'data:image/png;base64,' });
  await wait(80);
  assert.equal(jobs.on, true, 'still on after its time would have run out');
  assert.equal(wk.stopped, false);
  // two at once: the second is due 60 ms after the first is, so answering the first late-ish (at 45 ms) and the
  // second at 100 ms keeps both
  const b = settle(jobs.run('pdf', { n: 1 })),
    c = settle(jobs.run('pdf', { n: 1 }));
  await wait(45);
  wk.answer(wk.sent[1].id, 1);
  await wait(55);
  wk.answer(wk.sent[2].id, 2);
  assert.deepEqual(await b, { ok: true, v: 1 });
  assert.deepEqual(await c, { ok: true, v: 2 });
  assert.equal(jobs.on, true);
  assert.deepEqual(JSON.parse(JSON.stringify(jobs.stats.timedOut)), {});
  // the test hook off: jobs are sent as usual
  jobs.hang(0);
  const d = settle(jobs.run('png', { w: 1, h: 1 }));
  assert.equal(wk.sent[3].hang, undefined);
  wk.answer(wk.sent[3].id, 3);
  assert.deepEqual(await d, { ok: true, v: 3 });
});

test('how long a job is given: 4 s, and half a second more per million pixels', () => {
  const budget = withWorker().jobs.budget;
  assert.equal(budget({}), 4000);
  assert.equal(budget({ n: 256 * 256 }), 4033);
  // a PDF page (1700 × 2200): about 6 s
  assert.equal(budget({ n: 1700 * 2200 }), 5870);
  // the saved image, the section map, the label points: by their pictures' sizes
  assert.equal(budget({ w: 2000, h: 1000 }), 5000);
  assert.equal(budget({ W: 1000, H: 1000 }), 4500);
});

test('Tap something white: something already white says so, whatever it is', () => {
  const E = (s) => shared.__eval(s),
    spot = E('paperSpot'),
    lin8 = (r, g, b) => [r, g, b].map((v) => E(`srgbToLin(${v})`));
  for (const loose of [false, true]) {
    for (const c of [
      [242, 242, 242],
      [255, 255, 255],
    ]) {
      const r = spot(lin8(...c), loose);
      assert.equal(r.fix, null, String(c));
      assert.equal(r.note, 'That already looks white: nothing to correct.');
      assert.doesNotMatch(r.note, /paper/);
    }
  }
});
