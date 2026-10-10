// v309.2: Ben's decisions after the v309.1 debugging pass. The blender a set brings is said, Home's guide card counts
// colours; the welcome warns when nothing can be kept; Back after "I'll do this later"; the welcome's adds come off
// To buy and lose Running low marks, as Markers' Add a set; Save image is named after the guide (e2e/v305-show); the
// keyboard on Reveal's ✕ while it plays; a very small picture is said to be too small; Scan's answer chips wrap as one
// line.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setup, teardown, openApp, idle, sampleGuide, welcome, ROOT, scanFromMarkers } from './helpers.mjs';
import { join } from 'node:path';

before(setup);
after(teardown);

const visible = (page, id) =>
  page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
const KEY = 'ohuhu-hb320-picker-v3';

test('a set from the welcome: its blender is said; Home counts it, its guide card counts colours', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), '120 markers added');
  assert.equal(
    await page.textContent('#wcDone'),
    'Honolulu 120 and its Colorless Blender are in your collection. Anything else?',
  );
  await page.click('#wcLook');
  await idle(page);
  assert.equal(await page.textContent('#homeView .hcsub'), '121 markers');
  assert.match(await page.textContent('#homeCont .hcstart'), /Built from your 120 colours\./);
  assert.deepEqual(errors, []);
});

test('all of a set’s colours already yours, not its blender: "Colorless Blender added"', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  // (owned, but not onboarded, so the welcome shows: the colours of Honolulu 24 + 48 bar the blender)
  await page.click('#wcHaveSet');
  await page.evaluate(() => {
    presetMkeys(MARKER_SETS[1])
      .filter((k) => k !== 'Ohuhu|0')
      .forEach((k) => state.owned.add(k));
  });
  await page.check('#wcSets input[data-i="1"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.equal(await page.textContent('#wcT2'), 'Colorless Blender added');
  assert.equal(
    await page.textContent('#wcDone'),
    'Honolulu 48 was already in your collection; its Colorless Blender is now too. Anything else?',
  );
  assert.deepEqual(errors, []);
});

test('storage blocked: the welcome says nothing will be kept, before anything is added', async () => {
  const block = () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  };
  const { page, errors } = await openApp({ width: 820, height: 1180, init: block });
  await page.waitForSelector('#welcome.on');
  assert.ok(await page.isVisible('#wcStep0 .wcblocked'));
  assert.match(await page.textContent('#wcStep0 .wcblocked'), /nothing will be kept/);
  assert.deepEqual(errors, []);
});

test('"I’ll do this later" has Back (and Escape) to the three ways in', async () => {
  const { page, errors } = await openApp({ width: 820, height: 1180 });
  await page.click('#wcSkip');
  assert.equal(await page.textContent('#wcT2'), 'Explore with the full range');
  assert.ok(await visible(page, 'wcBack2'));
  await page.click('#wcBack2');
  assert.ok(await visible(page, 'wcStep0'));
  assert.equal(await page.evaluate(() => document.activeElement.id), 'wcSkip');
  await page.click('#wcSkip');
  await page.keyboard.press('Escape');
  await idle(page);
  assert.ok(await visible(page, 'wcStep0'), 'Escape is Back');
  // after a set, no Back on "Anything else?" (its Undo is the way back)
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="0"]');
  await page.click('#wcAdd');
  assert.equal(await visible(page, 'wcBack2'), false);
  assert.deepEqual(errors, []);
});

test('a set added in the welcome comes off To buy and loses its Running low mark; Undo puts both back', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: {
      [KEY]: JSON.stringify({
        mode: 'home',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: [],
        saved: [],
        wish: [{ k: 'Ohuhu|R014', why: 'x', ts: 1 }],
        ink: { 'Ohuhu|R014': 'low' },
      }),
    },
  });
  await page.waitForSelector('#welcome.on');
  await page.click('#wcHaveSet');
  await page.check('#wcSets input[data-i="3"]');
  await page.click('#wcAdd');
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => [
      state.owned.has('Ohuhu|R014'),
      state.wish.length,
      state.ink['Ohuhu|R014'] || null,
    ]),
    [true, 0, null],
  );
  // (v311: the Colorless Blender the set brings is said, as Markers' Add a set says it)
  assert.match(await page.textContent('#msToast'), /^Added 120 markers and a Colorless Blender\s·\s1\soff\sTo\sbuy/);
  await page.click('#toastAct');
  await idle(page);
  assert.deepEqual(
    await page.evaluate(() => [state.owned.size, state.wish.map((w) => w.k), state.ink['Ohuhu|R014']]),
    [0, ['Ohuhu|R014'], 'low'],
  );
  assert.deepEqual(errors, []);
});

test('Reveal: the keyboard is on its ✕ while it plays, then on Share', async () => {
  const { page, errors } = await openApp();
  await sampleGuide(page);
  await page.click('.sftabbtn[data-t="share"]');
  await page.click('#sfReveal');
  await page.waitForSelector('#sfRevX');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'sfRevX');
  await page.waitForSelector('#revShare', { timeout: 30000 });
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'revShare');
  assert.deepEqual(errors, []);
});

// a page scaled down to a short side of `short` px, picked as a photo
async function smallPage(page, short) {
  const buf = await readFile(join(ROOT, 'e2e', 'fixtures', 'letter-page.png'));
  const b64 = await page.evaluate(
    async ([b, short]) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b;
      await img.decode();
      const k = short / Math.min(img.naturalWidth, img.naturalHeight),
        c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k);
      c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    },
    [buf.toString('base64'), short],
  );
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.evaluate(() => SF.pickPhoto())]);
  await fc.setFiles({ name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });
  await page.waitForSelector('#sfBuild', { state: 'visible', timeout: 60000 });
  await idle(page);
}

test('a very small picture is said to be too small, never told to raise Min section size', async () => {
  for (const [short, small] of [
    [40, true],
    [120, false],
  ]) {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180 });
    await welcome(page, 'look');
    await idle(page);
    await smallPage(page, short);
    const t = await page.evaluate(() => document.body.innerText);
    // (120 px: no warning in Chromium; Safari's scaling leaves it in fragments, said as too small too)
    if (small) assert.match(t, /This picture is very small \(\d+ × \d+ pixels\)/, short + ' px');
    assert.doesNotMatch(t, /Found a lot of tiny fragments/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Scan’s answer chips: the words wrap as one line, "already yours" with them', async () => {
  const { page, errors } = await openApp({
    width: 820,
    height: 1180,
    storage: {
      'ms-onboarded': '1',
      'ms-setup-tip': '1',
      'ms-scan-brand': '',
      [KEY]: JSON.stringify({
        mode: 'collection',
        ownedSeedV: 2,
        copicAdd1: 1,
        libAdj1: 1,
        setFix1: 1,
        owned: ['Ohuhu|R16'],
        saved: [],
      }),
    },
  });
  await idle(page);
  await scanFromMarkers(page);
  await page.fill('#scBox', 'R16');
  await page.press('#scBox', 'Enter');
  await idle(page);
  const chip = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.scchoose')].find((x) => /already yours/.test(x.textContent));
    const t = b.querySelector('.scchtx');
    return { inSpan: !!t && t.querySelector('i') != null, text: t.textContent };
  });
  assert.ok(chip.inSpan, 'already yours inside the words');
  assert.equal(chip.text, 'R16 Light Salmon · Ohuhu · already yours');
  assert.deepEqual(errors, []);
});
