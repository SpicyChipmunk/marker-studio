// Markers › Scan or type codes: typed, pasted and Scan Text.
// (v320) Tests organised by feature: each block below came from the file named above it, its tests unchanged.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addFromMarkers,
  buildGo,
  clearCollection,
  idle,
  openApp,
  openBackupDialog,
  pause,
  sampleGuide,
  saveGuide,
  scanFromMarkers,
  scrollTop,
  sectionPoint,
  setup,
  teardown,
  welcome,
} from './helpers.mjs';

before(setup);
after(teardown);

// ---- from scan.test.mjs ----
// Markers › Scan or type codes (v296): codes typed, pasted or read off the caps with the iPad's Scan Text collect in a
// list to check, and Add puts the new ones in the collection.
{
  // an app with the Honolulu 120 set, on Markers, with the dialog open (v305: Either brand chosen before, as these tests
  // are about reading either brand: a collection all of one brand otherwise starts on its brand)
  async function opened() {
    const a = await openApp({ storage: { 'ms-scan-brand': '' } });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  const type = async (page, text) => {
    await page.fill('#scBox', text);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  // what Scan Text does: puts what the camera reads into the box (not a letter at a time), and swaps it as you aim
  const scanText = async (page, text) => {
    await page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }, text);
  };
  const paste = (page, text) =>
    page.evaluate((t) => {
      const d = new DataTransfer();
      d.setData('text/plain', t);
      document
        .getElementById('scBox')
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
    }, text);
  const list = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) => r.querySelector('.sccode').textContent + (r.classList.contains('mine') ? ' (mine)' : '')),
    );
  const owns = (page, k) => page.evaluate((k) => state.owned.has(k), k);
  const stat = (page) => page.textContent('#scStat');
  test('typed codes and a pasted list collect in a list to check; Add puts the new ones in the collection, Undo takes them out', async () => {
    const { page, errors } = await opened();
    assert.equal(await page.isVisible('#scanOverlay'), true);
    assert.equal(await page.textContent('#scAdd'), 'Add to my collection');
    assert.equal(await page.isDisabled('#scAdd'), true);
    // a mix-up put right, with its name: B015 (not in the 120 set)
    await type(page, 'BO15 Celadon Blue');
    assert.deepEqual(await list(page), ['B015']);
    assert.match(await stat(page), /B015 Celadon Blue.*Added to the list/);
    assert.equal(await page.inputValue('#scBox'), '', 'the box is ready for the next');
    // one already in the collection is listed as yours and not counted
    await type(page, 'R014');
    assert.deepEqual(await list(page), ['R014 (mine)', 'B015']);
    assert.match(await stat(page), /Already in your collection/);
    // the same again: said so, listed once
    await type(page, 'B015');
    assert.match(await stat(page), /Already in the list/);
    assert.equal((await list(page)).length, 2);
    // a pasted list: every code in it, at once
    await paste(page, 'E19 Dried Sage\nE49 Honey Brown\nnot a code');
    await idle(page);
    assert.deepEqual(await list(page), ['E49', 'E19', 'R014 (mine)', 'B015']);
    assert.match(await stat(page), /2 added to the list/);
    assert.equal((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), '4 markers · 3 new');
    assert.equal(await page.textContent('#scAdd'), 'Add 3 to my collection');
    // nothing in it is a code: said so
    await type(page, 'hello');
    assert.match(await stat(page), /No marker code found/);
    // ✕ takes one off the list
    await page.click('#scList .scrow:nth-child(1) .scdel');
    await idle(page);
    assert.deepEqual(await list(page), ['E19', 'R014 (mine)', 'B015']);
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.isVisible('#scanOverlay'), false);
    assert.equal(await owns(page, 'Ohuhu|B015'), true);
    assert.equal(await owns(page, 'Ohuhu|E19'), true);
    assert.equal(await owns(page, 'Ohuhu|E49'), false);
    assert.match(await page.textContent('#msToast'), /Added 2 markers to your collection/);
    // it was saved
    assert.ok(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem('ohuhu-hb320-picker-v3')).owned.includes('Ohuhu|B015'),
      ),
      'saved',
    );
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await owns(page, 'Ohuhu|B015'), false);
    assert.equal(await owns(page, 'Ohuhu|R014'), true, 'Undo leaves what was there before');
    // Undo brings the list back too, to put right and add again
    await scanFromMarkers(page);
    await idle(page);
    assert.deepEqual(await list(page), ['E19', 'R014 (mine)', 'B015']);
    // Add empties it
    await page.click('#scAdd');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.deepEqual(await list(page), []);
    assert.deepEqual(errors, []);
  });
  test('Scan Text: what arrives as you aim is read once it holds still, the box clears for the next cap; typing waits for Enter', async () => {
    const { page, errors } = await opened();
    // aiming: the text changes, then holds still
    await scanText(page, 'B0');
    await scanText(page, 'B015 Cela');
    await scanText(page, 'B015 Celadon Blue');
    await idle(page);
    assert.deepEqual(await list(page), ['B015'], 'read once, when it held still');
    assert.equal(await page.inputValue('#scBox'), '');
    await scanText(page, 'E19 Dried Sage');
    await idle(page);
    assert.deepEqual(await list(page), ['E19', 'B015']);
    // nothing readable while aiming: no complaint (the camera is still moving)
    await scanText(page, 'Ohuhu');
    await idle(page);
    assert.doesNotMatch(await stat(page), /No marker code/);
    // typing a letter at a time: nothing until Enter (Y, YG, YG0 aren't what was meant)
    await page.fill('#scBox', '');
    await page.type('#scBox', 'YG06 Sugarcane');
    await idle(page);
    assert.equal((await list(page)).length, 2, 'not read while typing');
    await page.press('#scBox', 'Enter');
    await idle(page);
    assert.deepEqual(await list(page), ['YG06 (mine)', 'E19', 'B015']);
    assert.deepEqual(errors, []);
  });
  test('asks when it cannot be sure, in the list (sweeping on loses no question); the brand chosen settles codes and is remembered', async () => {
    const { page, errors } = await opened();
    // B04: Ohuhu Pale Cyan or Copic Tahitian Blue — a question waiting in the list, not counted until answered
    await type(page, 'B04');
    assert.match(await stat(page), /B04: .*\?/);
    assert.equal(await page.locator('#scList .scask').count(), 1);
    assert.equal((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), '1 to choose');
    assert.equal(await page.isDisabled('#scAdd'), true);
    // reading on doesn't lose it, and the same question isn't asked twice
    await type(page, 'B015');
    await type(page, 'B04');
    assert.equal(await page.locator('#scList .scask').count(), 1);
    assert.equal((await page.textContent('#scCount')).replace(/\u00a0/g, ' '), '1 marker · 1 to choose');
    await page.click('#scList .scask .scchoose:has-text("Copic")');
    await idle(page);
    // (v318.7: the answer takes the question's place in the list, under B015 read after it; it had gone to the top)
    assert.deepEqual(await list(page), ['B015', 'B04']);
    assert.match(await page.textContent('#scList .scrow:nth-child(2)'), /Copic/);
    // only the name read: offered by the card above the list
    await type(page, 'Honey Brown');
    assert.match(await stat(page), /Is it E49 Honey Brown\?/);
    await page.click('#scStat .scpick button');
    await idle(page);
    assert.deepEqual(await list(page), ['E49', 'B015', 'B04']);
    // upside down: E19 reads "6L3" (Ohuhu E19, Copic E19 or E79); with Ohuhu chosen it's E19, added and marked
    await page.click('#scBrand button[data-b="Ohuhu"]');
    assert.equal(await page.getAttribute('#scBrand button[data-b="Ohuhu"]', 'aria-pressed'), 'true');
    await type(page, '6L3');
    assert.deepEqual(await list(page), ['E19', 'E49', 'B015', 'B04']);
    assert.match(await page.textContent('#scList .scrow'), /read upside down/);
    // YR213 upside down with its Y lost reads as R213: asked, in the list
    await type(page, 'ELZと');
    assert.match(await stat(page), /Upside down: which one\?/);
    await page.click('#scList .scask .scchoose:has-text("YR213")');
    await idle(page);
    assert.equal((await list(page))[0], 'YR213');
    // a code the brand chosen doesn't have: said so, and can be added anyway
    await type(page, 'C-3');
    assert.match(await stat(page), /Copic C-3 /);
    assert.match(await stat(page), /Another brand than the one chosen \(Ohuhu\)/);
    // (v318.22: typed, a question in the list, not a card the next code typed would replace)
    await page.click('#scList .scask .scchoose:has-text("C-3")');
    await idle(page);
    assert.equal((await list(page))[0], 'C-3');
    // the brand chosen is remembered
    await page.keyboard.press('Escape');
    await idle(page);
    await page.reload();
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.equal(await page.getAttribute('#scBrand button[data-b="Ohuhu"]', 'aria-pressed'), 'true');
    assert.deepEqual(errors, []);
  });
  test('words on the caps are not codes; holding one cap in view says it once', async () => {
    const { page, errors } = await opened();
    // names and words that look a little like codes: Egg (E66), Bog (B06), No.3 (N-0), Sea upside down (Y35)
    for (const w of ['Robin Egg Blue', 'Bog Mist Green', 'Neutral Gray No.3', 'Sea']) {
      await scanText(page, w);
      await idle(page);
    }
    assert.deepEqual(await list(page), []);
    // the camera held on one cap: the same text comes again after the box clears; one beep, not one a second
    await page.evaluate(() => {
      window.__said = 0;
      const el = document.getElementById('scStat');
      new MutationObserver(() => window.__said++).observe(el, { childList: true });
    });
    for (let k = 0; k < 3; k++) {
      await scanText(page, 'B015 Celadon Blue');
      await idle(page);
    }
    assert.deepEqual(await list(page), ['B015']);
    assert.equal(await page.evaluate(() => window.__said), 1, 'said once');
    // typed again on purpose: said
    await type(page, 'B015');
    assert.match(await stat(page), /Already in the list/);
    assert.equal(await page.inputValue('#scBox'), '', 'the box clears for a marker already listed, too');
    assert.deepEqual(errors, []);
  });
  test('two caps held in view say so once; a question answered isn’t asked again; choosing a brand answers its questions; focus stays in the box', async () => {
    const { page, errors } = await opened();
    await page.evaluate(() => {
      window.__said = 0;
      new MutationObserver(() => window.__said++).observe(document.getElementById('scStat'), {
        childList: true,
      });
    });
    for (let k = 0; k < 3; k++) {
      await scanText(page, 'B015 Celadon Blue E19 Dried Sage');
      await idle(page);
    }
    assert.deepEqual(await list(page), ['E19', 'B015']);
    assert.equal(await page.evaluate(() => window.__said), 1, 'said once');
    // B04 asked, answered, read again by Scan Text with the cap still in view: not asked again (v299: typed again, it
    // is asked: that could be the other brand's B04)
    await type(page, 'B04');
    await page.click('#scList .scask .scchoose:has-text("Copic")');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox', 'back in the box');
    await scanText(page, 'B04');
    await idle(page);
    assert.equal(await page.locator('#scList .scask').count(), 0);
    // a question between brands, then the brand chosen: answered
    await type(page, 'B05');
    assert.equal(await page.locator('#scList .scask').count(), 1);
    await page.click('#scBrand button[data-b="Ohuhu"]');
    await idle(page);
    assert.equal(await page.locator('#scList .scask').count(), 0);
    assert.equal((await list(page))[0], 'B05');
    assert.match(await page.textContent('#scList .scrow'), /Ohuhu/);
    // ✕: back in the box, as the box had the keyboard when the tap began (v318.7: and not otherwise — e2e/v3187-answer)
    await page.focus('#scBox');
    await page.click('#scList .scrow .scdel');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
    await type(page, 'B05');
    await page.evaluate(() => document.getElementById('scAdd').focus());
    await page.click('#scList .scrow .scdel');
    await idle(page);
    assert.equal(
      await page.evaluate(() => document.activeElement.className),
      'scdel',
      'the box hadn’t the keyboard: on the row that took its place',
    );
    // text with nothing to read in it doesn't stay to run into the next cap's
    await scanText(page, 'Ohuhu');
    await idle(page, 2200);
    assert.equal(await page.inputValue('#scBox'), '');
    assert.deepEqual(errors, []);
  });
  test('a whole collection pasted at once: every marker listed, quickly', async () => {
    const { page, errors } = await opened();
    // (v303: not the colourless blender, 0, which both brands have under the same name, so is asked about)
    const codes = await page.evaluate(() =>
      COLORS.filter((c) => c.brand === 'Ohuhu' && c.code !== '0')
        .map((c) => c.code + ' ' + c.name)
        .join('\n'),
    );
    const t0 = Date.now();
    await paste(page, codes);
    await idle(page);
    const ms = Date.now() - t0;
    const n = await page.evaluate(() => COLORS.filter((c) => c.brand === 'Ohuhu' && c.code !== '0').length);
    assert.equal((await list(page)).length, n);
    assert.ok(ms < 8000, ms + ' ms');
    assert.match(await page.textContent('#scAdd'), new RegExp('Add ' + (n - 120) + ' to my collection'));
    assert.deepEqual(errors, []);
  });
  test('a marker on the To buy list is taken off it when added (bought), and Undo puts it back', async () => {
    const { page, errors } = await opened();
    await page.evaluate(() => {
      addWish('Ohuhu|B015', 'test', true);
      save();
    });
    await type(page, 'B015');
    await page.click('#scAdd');
    await idle(page);
    assert.match(await page.textContent('#msToast'), /^Added 1 marker · 1 off To buy/);
    assert.equal(await page.evaluate(() => isWished('Ohuhu|B015')), false);
    await page.click('#toastAct');
    await idle(page);
    assert.equal(await page.evaluate(() => isWished('Ohuhu|B015')), true);
    assert.equal(await owns(page, 'Ohuhu|B015'), false);
    assert.deepEqual(errors, []);
  });
  test('Escape closes it with focus back on its button; the list is kept until added', async () => {
    const { page, errors } = await opened();
    await type(page, 'B015');
    await page.keyboard.press('Escape');
    await idle(page);
    assert.equal(await page.isVisible('#scanOverlay'), false);
    // (v311: what opened it on Markers: + Add markers, or the empty collection's card)
    assert.ok(
      ['mkAddBtn', 'mkcScan'].includes(
        await page.evaluate(() => document.activeElement && document.activeElement.id),
      ),
    );
    await scanFromMarkers(page);
    await idle(page);
    assert.deepEqual(await list(page), ['B015']);
    // a tap outside the card closes it too
    await page.mouse.click(5, 830);
    await idle(page);
    assert.equal(await page.isVisible('#scanOverlay'), false);
    assert.deepEqual(errors, []);
  });
  // (v309: the welcome's "I bought them one by one" › Scan the caps opens it over the welcome, which then goes on)
  test('the welcome offers it for markers bought one at a time: the dialog over the welcome, the box ready; Add, and the welcome goes on', async () => {
    const { page, errors } = await openApp();
    assert.ok(await page.isVisible('#welcome'));
    await page.click('#wcOneByOne');
    await page.click('#wcOneScan');
    await idle(page);
    assert.ok(await page.isVisible('#welcome'), 'the welcome stays under it');
    assert.ok(await page.isVisible('#scanOverlay'));
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
    await type(page, 'B015');
    await page.click('#scAdd');
    await idle(page);
    assert.deepEqual(await page.evaluate(() => [...state.owned]), ['Ohuhu|B015']);
    assert.equal(await page.textContent('#wcT2'), '1 marker added');
    await page.click('#wcLook');
    await idle(page);
    // the welcome doesn't come back
    await page.reload();
    await idle(page);
    assert.equal(await page.isVisible('#welcome'), false);
    assert.deepEqual(errors, []);
  });
}

// ---- from v298.test.mjs ----
// v298: fixes from the second fresh-eyes review of v297 — ticks follow merged and split sections; Focus mode says
// where it is up to; zones keep touching sections apart across their borders; a guide file with odd keys opens; the
// sets list follows Clear collection; and Scan's box: the same text again is still cleared, Enter then the same cap
// again is read, letters composed by an Android keyboard wait for Enter, and a card isn't repeated while held.
{
  async function scanOpened(opts) {
    const a = await openApp(opts);
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  const scanText = (page, text) =>
    page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }, text);
  const list = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent),
    );
  const stat = (page) => page.textContent('#scStat');
  test('Scan: the same text coming back is still cleared; after Enter the same code is read again; Android’s composed letters wait for Enter', async () => {
    // (v299: the composed-letters rule is Android's only)
    const { page, errors } = await scanOpened({
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36',
    });
    // read, then (before it clears) the camera swaps the text and puts the same back: still cleared
    await scanText(page, 'E19 Dried Sage');
    await page.waitForFunction(() => document.querySelector('#scList .scrow'));
    await scanText(page, 'E1');
    await scanText(page, 'E19 Dried Sage');
    await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 4000 });
    assert.deepEqual(await list(page), ['E19']);
    // typed with Enter, then Scan Text brings the same code (another cap): read, not left in the box
    await page.click('#scClear');
    await page.click('#scClear');
    await page.fill('#scBox', 'B015');
    await page.press('#scBox', 'Enter');
    await idle(page);
    assert.deepEqual(await list(page), ['B015']);
    await page.click('#scClear');
    await page.click('#scClear');
    await scanText(page, 'B015');
    await page.waitForFunction(() => document.querySelector('#scList .scrow'), null, { timeout: 4000 });
    assert.deepEqual(await list(page), ['B015']);
    // Gboard: each letter a composition of the whole word so far; a pause after "R1" reads nothing
    await page.click('#scClear');
    await page.click('#scClear');
    await page.evaluate(() => {
      const b = document.getElementById('scBox');
      b.value = '';
      b.dispatchEvent(new Event('scanreset'));
    });
    for (const v of ['R', 'R1']) {
      await page.evaluate((v) => {
        const b = document.getElementById('scBox');
        b.value = v;
        b.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            inputType: 'insertCompositionText',
            data: v,
            isComposing: true,
          }),
        );
      }, v);
    }
    await page.waitForTimeout(1000); // longer than the box waits for text to hold still: nothing may be read
    assert.deepEqual(await list(page), [], 'nothing read half-typed');
    assert.equal(await page.inputValue('#scBox'), 'R1');
    assert.deepEqual(errors, []);
  });
  test('Scan: another brand’s code says the marker and that it’s another brand, once while it’s held in view', async () => {
    const { page, errors } = await scanOpened();
    await page.click('#scBrand button[data-b="Ohuhu"]');
    await page.evaluate(() => {
      window.__beeps = 0;
      const o = scanBeep;
      window.scanBeep = scanBeep = function (k) {
        window.__beeps++;
        return o(k);
      };
    });
    await scanText(page, 'C-3');
    await idle(page, 1200);
    assert.match(await stat(page), /^.?Copic C-3 /);
    assert.match(await stat(page), /Another brand than the one chosen \(Ohuhu\)/);
    const b1 = await page.evaluate(() => window.__beeps);
    await scanText(page, 'C-3 ');
    await idle(page, 1200);
    await scanText(page, 'C-3');
    await idle(page, 1200);
    assert.equal(await page.evaluate(() => window.__beeps), b1, 'not again while held');
    assert.deepEqual(errors, []);
  });
  test('Scan: a pasted list with a line of only a name and a line of another brand’s code asks about each in the list', async () => {
    const { page, errors } = await scanOpened();
    await page.click('#scBrand button[data-b="Ohuhu"]');
    await page.evaluate((t) => {
      const d = new DataTransfer();
      d.setData('text/plain', t);
      document
        .getElementById('scBox')
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
    }, 'B015\nHoneydew Melon\nC-3');
    await idle(page);
    const asks = await page.$$eval('#scList .scask b', (b) => b.map((x) => x.textContent));
    assert.equal(asks.length, 2, asks.join(' | '));
    assert.ok(asks.some((t) => /Only its name was read/.test(t)));
    assert.ok(asks.some((t) => /Another brand than the one chosen \(Ohuhu\)/.test(t)));
    assert.match(await stat(page), /1 added to the list/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v299.test.mjs ----
// v299: fixes from the third fresh-eyes review — two of v298's own fixes put right (section edits from an earlier visit
// kept; Undo of a merge after a build gives the ticks back); a split-off coloured part keeps its marker and zone; the
// copy kept as the page goes works for edited guides; changes that couldn't be saved open instead of the older copy;
// Undo for Mark all coloured, Focus's Mark all done and a palette colour re-rolled; an old guide using Copic 0; and
// Scan's paste, typing and Clear list, Match's announcements, Random with nothing to draw.
{
  // (v305: Either brand chosen before, as these tests are about reading either brand: a collection all of one brand
  // otherwise starts on its brand)
  async function scanOpened(opts) {
    const a = await openApp({ storage: { 'ms-scan-brand': '' }, ...opts });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  const scanText = (page, text) =>
    page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    }, text);
  const paste = (page, text) =>
    page.evaluate((t) => {
      const d = new DataTransfer();
      d.setData('text/plain', t);
      document
        .getElementById('scBox')
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
    }, text);
  const list = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent),
    );
  test('Scan: Copic B04 typed after Ohuhu B04 is asked about; a paste reads what Scan Text left waiting; a letter typed after a read starts afresh; Clear list takes two taps', async () => {
    const { page, errors } = await scanOpened();
    const ohB04 = await page.evaluate(() => COLORS.find((c) => c.brand === 'Ohuhu' && c.code === 'B04').name);
    await page.fill('#scBox', 'B04 ' + ohB04);
    await page.press('#scBox', 'Enter');
    await idle(page);
    await page.fill('#scBox', 'B04');
    await page.press('#scBox', 'Enter');
    await idle(page);
    assert.equal(await page.locator('#scList .scask').count(), 1, 'asked: Copic’s B04 too?');
    // Scan Text text waiting to hold still, then a paste: both read
    await scanText(page, 'E19 Dried Sage');
    await paste(page, 'B015');
    await idle(page);
    const l = await list(page);
    assert.ok(l.includes('E19') && l.includes('B015'), l.join(','));
    assert.equal(await page.inputValue('#scBox'), '');
    // read, then a letter typed straight away: the box holds the letter, not the old text with it
    await scanText(page, 'R014');
    await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length >= 5, null, {
      timeout: 3000,
    });
    await page.evaluate(() => {
      const b = document.getElementById('scBox');
      b.value = b.value + 'E';
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'E' }));
    });
    assert.equal(await page.inputValue('#scBox'), 'E');
    // Clear list: the first tap only asks
    const n = (await list(page)).length;
    await page.click('#scClear');
    assert.equal((await list(page)).length, n);
    assert.equal(await page.textContent('#scClear'), 'Tap again to clear');
    await page.click('#scClear');
    assert.equal((await list(page)).length, 0);
    assert.deepEqual(errors, []);
  });
}

// ---- from v303-scan.test.mjs ----
// v303: Scan or type codes in the dialog — text left in the box is read on Add, a card's Add clears the text it was
// about, the brand switch answers what it can and says so, the list outlasts a reload, a phone at a large text size
// gets the code over its name, Add leaves focus where it was opened from and the sets' ticks follow.
{
  // (v305: Either brand chosen before, as these tests are about reading either brand: a collection all of one brand
  // otherwise starts on its brand)
  async function opened(o = {}) {
    const a = await openApp({ storage: { 'ms-scan-brand': '' }, ...o });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  const type = async (page, text) => {
    await page.fill('#scBox', text);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  const list = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) => (r.classList.contains('scask') ? '?' : r.querySelector('.sccode').textContent)),
    );
  test('Add reads what’s still in the box (typed without Enter); a card’s Add takes its text out of the box', async () => {
    const { page, errors } = await opened();
    // (nothing new in the list yet: Add is on while there's text in the box)
    assert.equal(await page.isDisabled('#scAdd'), true);
    await page.fill('#scBox', 'B015');
    assert.equal(await page.isDisabled('#scAdd'), false);
    await page.click('#scAdd');
    await idle(page);
    assert.ok(
      await page.evaluate(() =>
        state.owned.has(mkey(COLORS.findIndex((c) => c.brand === 'Ohuhu' && c.code === 'B015'))),
      ),
      'B015 added',
    );
    // a name only: a card with Add; after it, the box is clear for the next code
    await scanFromMarkers(page);
    await idle(page);
    await type(page, 'Honey Brown');
    assert.equal(await page.inputValue('#scBox'), 'Honey Brown', 'kept, nothing in it to clear the box for');
    await page.click('#scStat .scpick button');
    await idle(page);
    assert.equal(await page.inputValue('#scBox'), '', 'the name’s gone from the box');
    await type(page, 'YG06');
    assert.deepEqual(
      (await list(page)).filter((x) => x !== '?'),
      ['E49'],
    );
    assert.ok((await list(page)).includes('?'), 'YG06: Ohuhu or Copic, asked');
    assert.deepEqual(errors, []);
  });
  test('the brand switch answers the questions it can, says so, and goes back to the box', async () => {
    const { page, errors } = await opened();
    await type(page, 'B04');
    assert.deepEqual(await list(page), ['?']);
    await page.click('#scBrand button[data-b="Copic"]');
    await idle(page);
    assert.deepEqual(await list(page), ['B04']);
    assert.match(await page.textContent('#scStat'), /1 question answered/);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'scBox');
    // with Ohuhu chosen, Copic's C-3 read beside an Ohuhu code waits as "another brand"; Either brand answers it
    await page.click('#scBrand button[data-b="Ohuhu"]');
    await idle(page);
    await type(page, 'E19 C-3');
    assert.ok((await list(page)).includes('?'));
    await page.click('#scBrand button[data-b=""]');
    await idle(page);
    assert.deepEqual((await list(page)).sort(), ['B04', 'C-3', 'E19']);
    assert.deepEqual(errors, []);
  });
  test('the list outlasts a reload (Safari reloading a tab put away mid-sweep)', async () => {
    const { page, errors } = await opened();
    await type(page, 'E19 Dried Sage');
    await type(page, 'B04');
    await page.reload();
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.deepEqual(await list(page), ['?', 'E19']);
    assert.equal(await page.textContent('#scAdd'), 'Add 1 to my collection');
    // emptied by Add
    await page.click('#scAdd');
    await idle(page);
    assert.equal(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem('ms-scan-list') || '[]').filter((e) => !e.ask).length,
      ),
      0,
    );
    assert.deepEqual(errors, []);
  });
  test('a phone at the largest text size: a row’s code over its name, the name the row’s width', async () => {
    const { page, errors } = await opened({ width: 320, height: 640 });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--tpx0', '1.6px');
    });
    await type(page, 'YG06 Sugarcane');
    await idle(page);
    const r = await page.$eval('#scList .scrow', (row) => {
      const c = row.querySelector('.sccode').getBoundingClientRect(),
        n = row.querySelector('.scname').getBoundingClientRect();
      return {
        cTop: c.top,
        nTop: n.top,
        nW: n.width,
        rowW: row.getBoundingClientRect().width,
        over: row.scrollWidth > row.clientWidth + 1,
      };
    });
    assert.ok(r.nTop > r.cTop + 5, 'the name under the code');
    assert.ok(r.nW > r.rowW * 0.5, 'the name has room: ' + JSON.stringify(r));
    assert.equal(r.over, false);
    assert.deepEqual(errors, []);
  });
  test('Add into an empty collection: focus goes back to the button it was opened from, and the sets’ counts follow', async () => {
    const { page, errors } = await openApp();
    await welcome(page, 'look');
    await idle(page);
    await page.evaluate(() => {
      state.owned.clear();
      save();
    });
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await type(page, 'E19 Dried Sage');
    await page.click('#scAdd');
    await idle(page);
    await page.waitForTimeout(100);
    // (v311: what opened it on Markers: + Add markers, or the empty collection's card)
    assert.ok(
      ['mkAddBtn', 'mkcScan'].includes(
        await page.evaluate(() => document.activeElement && document.activeElement.id),
      ),
    );
    assert.deepEqual(errors, []);
  });
  test('several read at once, all already yours: said so, not “added” with the success sound', async () => {
    const { page, errors } = await opened();
    // two codes of the Honolulu 120 set, only Ohuhu's
    const two = await page.evaluate(() => {
      const ix = scanIndex(),
        c = (k) => COLORS[keyIdx(k)].code,
        own = [...state.owned].filter((k) => {
          const s = scanKey(c(k));
          return /\D/.test(s) && ix.byCode.get(s).length === 1 && !ix.byOld.has(s);
        });
      return own.slice(0, 2).map(c);
    });
    await type(page, two.join(' '));
    const s = await page.textContent('#scStat');
    assert.match(s, /All already in your collection/);
    assert.equal(await page.getAttribute('#scStat', 'class'), 'scstat same');
    assert.deepEqual(errors, []);
  });
}

// ---- from v305-small.test.mjs ----
// v305 small items: Back up & restore's two Restore buttons say which; Match's hex code part-typed greys the last result
// and, on Enter, says what's expected; Scan with a collection all of one brand starts on that brand, visibly, when no
// brand was ever chosen and Brands I'd buy is that brand too (or automatic), and the choices say which are yours.
{
  const KEY = 'ohuhu-hb320-picker-v3';
  const onboarded = (extra = {}) => ({
    'ms-onboarded': '1',
    'ms-setup-tip': '1',
    'ms-last-ver': 'v305',
    ...extra,
  });
  const OHUHU = [
    'Ohuhu|R014',
    'Ohuhu|Y111',
    'Ohuhu|B08',
    'Ohuhu|G36',
    'Ohuhu|BV310',
    'Ohuhu|YR313',
    'Ohuhu|RV08',
    'Ohuhu|B04',
  ];
  const appState = (extra = {}) =>
    JSON.stringify({
      mode: 'collection',
      ownedSeedV: 2,
      copicAdd1: 1,
      libAdj1: 1,
      setFix1: 1,
      owned: OHUHU,
      saved: [],
      ...extra,
    });
  const scanOpen = async (page) => {
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
  };
  const pressed = (page) => page.$eval('#scBrand button[aria-pressed="true"]', (b) => b.dataset.b);
  const type = async (page, text) => {
    await page.fill('#scBox', text);
    await page.press('#scBox', 'Enter');
    await idle(page);
  };
  test('Scan: an all-Ohuhu collection starts on Ohuhu, shown and said, until a brand is tapped; never stored by itself', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState() }),
    });
    await scanOpen(page);
    assert.equal(await pressed(page), 'Ohuhu');
    assert.match(
      await page.textContent('#scStat'),
      /Set to Ohuhu, the brand of all your markers · Either brand reads both/,
    );
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), null, 'not stored');
    // a Copic-only code asks (v318.7: with the brand set for you, a Copic cap read whole is a question in the list, said
    // so, not a card saying "chosen": the sweep may show the caps are Copic's)
    await type(page, 'B000');
    assert.match(
      await page.textContent('#scStat'),
      /Copic B000 Pale Porcelain Blue: add it\? Ohuhu was set for you/,
    );
    assert.match(await page.textContent('#scList .scask'), /Ohuhu was set for you/);
    // Either brand, tapped: kept from now on
    await page.click('#scBrand button[data-b=""]');
    await idle(page);
    assert.equal(await page.evaluate(() => localStorage.getItem('ms-scan-brand')), '');
    await page.click('#scClose');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    assert.equal(await pressed(page), '');
    assert.match(await page.textContent('#scStat'), /Each marker read shows here/);
    assert.deepEqual(errors, []);
  });
  test('Scan: Either brand to start when your markers are of two brands, or Brands I’d buy has another brand', async () => {
    for (const [extra, why] of [
      [{ owned: [...OHUHU, 'Copic|E09'] }, 'two brands'],
      [{ buyBrands: ['Ohuhu', 'Copic'] }, 'Brands I’d buy: both'],
      [{ buyBrands: ['Copic'] }, 'Brands I’d buy: Copic'],
    ]) {
      const { page, errors } = await openApp({
        width: 1180,
        height: 820,
        storage: onboarded({ [KEY]: appState(extra) }),
      });
      await scanOpen(page);
      assert.equal(await pressed(page), '', why);
      assert.match(await page.textContent('#scStat'), /Each marker read shows here/, why);
      assert.deepEqual(errors, []);
      await page.context().close();
    }
    // Brands I'd buy set to Ohuhu alone: as automatic
    const { page, errors } = await openApp({
      width: 1180,
      height: 820,
      storage: onboarded({ [KEY]: appState({ buyBrands: ['Ohuhu'] }) }),
    });
    await scanOpen(page);
    assert.equal(await pressed(page), 'Ohuhu');
    assert.deepEqual(errors, []);
  });
  test('Scan: a question’s choices say which one is already yours', async () => {
    const { page, errors } = await openApp({
      width: 820,
      height: 1180,
      storage: onboarded({ [KEY]: appState(), 'ms-scan-brand': '' }),
    });
    await scanOpen(page);
    // B04: Ohuhu's (yours) or Copic's
    await type(page, 'B04');
    const choices = await page.$$eval('#scList .scask .scchoose', (bs) => bs.map((b) => b.textContent));
    assert.equal(choices.length, 2);
    assert.match(
      choices.find((c) => /Ohuhu/.test(c)),
      /· Ohuhu · already yours$/,
    );
    assert.doesNotMatch(
      choices.find((c) => /Copic/.test(c)),
      /already yours/,
    );
    assert.deepEqual(errors, []);
  });
}

// ---- from v3085.test.mjs ----
// v308.5: Copy diagnostics carries a trace of what Scan's box was sent this visit (Scan Text on an iPad stopped after
// the first cap; the trace shows what the iPad sends).
{
  test('Scan’s box events are kept for Copy diagnostics: input, the read and the clear', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
    await welcome(page, 'look');
    await idle(page);
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await idle(page);
    await page.evaluate(() => {
      const b = document.getElementById('scBox');
      b.value = 'B015 Celadon Blue';
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    });
    await page.waitForTimeout(1200);
    const d = await page.evaluate(() => errDetails());
    assert.match(d, /Scan box, this visit:/);
    assert.match(d, /input insertReplacementText value:17 "B015 Celadon Blue"/);
    assert.match(d, /read: 1 found/);
    assert.match(d, /cleared by the app/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v3086.test.mjs ----
// v308.6: Scan Text on iPadOS 27 puts each cap's text in as a composition and takes it out itself when the cap leaves
// view (Ben's log from the Scan Text Bench). The app cleared the box mid-composition, which stopped Scan Text after the
// first cap. Now the box is left alone during a composition; each cap is read as it arrives.
{
  async function opened() {
    const a = await openApp({ width: 820, height: 1180, storage: { 'ms-scan-brand': '' } });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  // what the iPad sent (Ben's log): compositionstart, then the text as insertCompositionText; when the cap goes,
  // deleteCompositionText to empty, then compositionend
  const capIn = (page, t) =>
    page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      b.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: t }));
      b.value = t;
      b.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          isComposing: true,
          data: t,
        }),
      );
    }, t);
  const capOut = (page) =>
    page.evaluate(() => {
      const b = document.getElementById('scBox');
      b.value = '';
      b.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'deleteCompositionText', isComposing: true }),
      );
      b.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '' }));
    });
  const list = (page) => page.$$eval('#scList .sccode', (l) => l.map((x) => x.textContent));
  test('Scan Text’s composition: each cap read, the box left for Scan Text to clear, cap after cap', async () => {
    const { page, errors } = await opened();
    await capIn(page, 'RV33 Thistle');
    await page.waitForTimeout(1300);
    assert.deepEqual(await list(page), ['RV33']);
    assert.equal(await page.inputValue('#scBox'), 'RV33 Thistle', 'not cleared by the app mid-composition');
    await capOut(page);
    await capIn(page, 'RV311 Pansy');
    await page.waitForTimeout(900);
    await capOut(page);
    // a cap re-read with a misreading, then the next cap
    await capIn(page, 'RV39 Bright Fuchsia');
    await page.waitForTimeout(300);
    await capOut(page);
    await capIn(page, 'RV39 angr uchsa');
    await page.waitForTimeout(900);
    await capOut(page);
    await capIn(page, 'RV310 Fuchsia');
    await page.waitForTimeout(900);
    assert.deepEqual(await list(page), ['RV310', 'RV39', 'RV311', 'RV33']);
    // text with no code, mid-composition: left alone too (it had been cleared after 1.5 s)
    await capOut(page);
    await capIn(page, 'Fuchsia');
    await page.waitForTimeout(1900);
    assert.equal(await page.inputValue('#scBox'), 'Fuchsia');
    await capOut(page);
    assert.deepEqual(errors, []);
  });
  test('Add while Scan Text’s text is still in the box: it is read and added (Add then closes Scan, as before)', async () => {
    const { page, errors } = await opened();
    await capIn(page, 'YR58');
    await page.click('#scAdd');
    await idle(page);
    assert.equal(await page.evaluate(() => state.owned.has('Ohuhu|YR58')), true);
    assert.equal(await page.isVisible('#scanOverlay'), false);
    // opened again: a new Scan Text session, read as usual
    await scanFromMarkers(page);
    await idle(page);
    await capIn(page, 'YR59 Cantaloupe');
    await page.waitForTimeout(900);
    assert.deepEqual(await list(page), ['YR59']);
    assert.deepEqual(errors, []);
  });
  test('without a composition (an older iPadOS, a paste, typing) the box still clears after a read, as before', async () => {
    const { page, errors } = await opened();
    await page.evaluate(() => {
      const b = document.getElementById('scBox');
      b.value = 'B015 Celadon Blue';
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }));
    });
    await page.waitForTimeout(1200);
    assert.deepEqual(await list(page), ['B015']);
    assert.equal(await page.inputValue('#scBox'), '');
    assert.deepEqual(errors, []);
  });
}

// ---- from v317-scan.test.mjs ----
// v317: Scan on Android. The steps say Gboard's Scan text; text arriving two or more characters at once (Gboard's
// Insert, as a composition after its key 229 or committed) is read without Enter, while a code composed a letter at a
// time, a suggestion tapped or a correction still waits for Enter; text read during a composition that the keyboard
// leaves in the box goes when the composition ends. The Lens / Live Text line is on every device. The iPad's steps and
// box are as they were (v3086.test.mjs, v298.test.mjs).
{
  const ANDROID_UA =
    'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
  const IPAD_UA =
    'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  async function opened(userAgent, width = 390, height = 844) {
    const a = await openApp({ width, height, storage: { 'ms-scan-brand': '' }, userAgent });
    await welcome(a.page, 'look');
    await idle(a.page);
    await a.page.click('#mCollection');
    await idle(a.page);
    await scanFromMarkers(a.page);
    await idle(a.page);
    return a;
  }
  // Android Chrome sends keydown 229 before what the keyboard puts in
  const key229 = (page) =>
    page.evaluate(() => {
      const b = document.getElementById('scBox');
      b.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified', keyCode: 229 }));
      b.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified', keyCode: 229 }));
    });
  // a composition: started, or the whole of it so far (Gboard composes a word a letter at a time)
  const compIn = (page, t, start) =>
    page.evaluate(
      ([t, start]) => {
        const b = document.getElementById('scBox');
        if (start) b.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        b.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: t }));
        b.value = t;
        b.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            inputType: 'insertCompositionText',
            isComposing: true,
            data: t,
          }),
        );
      },
      [t, start],
    );
  // the composition committed as Chrome does it: a last insertCompositionText with the whole text, then compositionend
  const compEnd = (page, t) =>
    page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value = t;
      b.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          isComposing: true,
          data: t,
        }),
      );
      b.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: t }));
    }, t);
  // committed outright (commitText: insertText with the whole string)
  const commitIn = (page, t) =>
    page.evaluate((t) => {
      const b = document.getElementById('scBox');
      b.value += t;
      b.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: t }));
    }, t);
  const list = (page) =>
    page.$$eval('#scList .scrow', (rs) =>
      rs.map((r) => (r.querySelector('.sccode') || r.querySelector('b')).textContent),
    );
  const steps = (page) => page.$$eval('#scHow li b', (l) => l.map((b) => b.textContent));
  test('Android: the steps say Gboard’s Scan text, and the Lens line; an iPad keeps AutoFill › Scan Text and Live Text', async () => {
    const a = await opened(ANDROID_UA);
    assert.deepEqual(await steps(a.page), ['Tap the box', 'Gboard › Scan text', 'Snap, then Insert']);
    assert.match(
      await a.page.textContent('#scHow'),
      /tap ✓ after it[\s\S]*With Gboard \(free on Google Play\)[\s\S]*four squares[\s\S]*tap Scan text[\s\S]*Photograph one cap and tap Insert: its code is read, with a beep\. Then ← for the next cap\./,
    );
    // (v318: the set's box or an order email too)
    assert.match(
      await a.page.textContent('#scLensT'),
      /^A whole tray, the set’s box or an order email: copy its text with Google Lens, then long-press the box › Paste\. A set’s name adds the whole set, asked first\.$/,
    );
    const b = await opened(IPAD_UA);
    assert.deepEqual(await steps(b.page), ['Tap the box', 'AutoFill › Scan Text', 'Cap after cap']);
    assert.match(
      await b.page.textContent('#scLensT'),
      /copy its text \(Live Text in Photos, or Google Lens\) and paste it here/,
    );
    assert.deepEqual(a.errors.concat(b.errors), []);
  });
  test('Android: a cap’s text put in at once, as a composition after key 229 or committed, is read and the box cleared; the next cap too', async () => {
    const { page, errors } = await opened(ANDROID_UA);
    // committed over an open composition (Chrome: the whole text once more, then compositionend)
    await key229(page);
    await compIn(page, 'E75 Light Rose Taupe', true);
    await compEnd(page, 'E75 Light Rose Taupe');
    await page.waitForFunction(() => document.querySelector('#scList .scrow'), null, { timeout: 3000 });
    assert.deepEqual(await list(page), ['E75']);
    await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 3000 });
    // committed outright
    await key229(page);
    await commitIn(page, 'CG17 Cool Grey');
    await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length === 2, null, {
      timeout: 3000,
    });
    assert.deepEqual(await list(page), ['CG17', 'E75']);
    await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 3000 });
    // a composition left open: read, left in the box (never cleared mid-composition, v308.6), replaced by the next cap,
    // and cleared once the composition ends
    await key229(page);
    await compIn(page, 'B015 Celadon Blue', true);
    await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length === 3, null, {
      timeout: 3000,
    });
    await pause(page, 500, 'the box is cleared 250 ms after a read: not during a composition');
    assert.equal(await page.inputValue('#scBox'), 'B015 Celadon Blue');
    await key229(page);
    await compIn(page, 'YG06 Sugarcane', false);
    await page.waitForFunction(() => document.querySelectorAll('#scList .scrow').length === 4, null, {
      timeout: 3000,
    });
    assert.deepEqual(await list(page), ['YG06', 'B015', 'CG17', 'E75']);
    await pause(page, 500, 'the box is cleared 250 ms after a read: not during a composition');
    assert.equal(await page.inputValue('#scBox'), 'YG06 Sugarcane');
    await compEnd(page, 'YG06 Sugarcane');
    assert.equal(await page.inputValue('#scBox'), '');
    assert.deepEqual(errors, []);
  });
  test('Android: a code composed a letter at a time, a correction on space and a suggestion tapped are typing: nothing read until Enter', async () => {
    const { page, errors } = await opened(ANDROID_UA);
    for (const v of ['e', 'e7', 'e75']) {
      await key229(page);
      await compIn(page, v, v === 'e');
    }
    await key229(page);
    await compEnd(page, 'E75 '); // autocorrect on space
    await pause(page, 1000, 'longer than the box waits for text to hold still: nothing may be read');
    assert.deepEqual(await list(page), []);
    assert.equal(await page.inputValue('#scBox'), 'E75 ');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.deepEqual(await list(page), ['E75']);
    // a name typed with suggestions: "Ta" to "Taupe "
    for (const v of ['L', 'Li', 'Lig', 'Ligh', 'Light']) {
      await key229(page);
      await compIn(page, v, v === 'L');
    }
    await key229(page);
    await compEnd(page, 'Light ');
    for (const v of ['Light T', 'Light Ta']) {
      await key229(page);
      await compIn(page, v, v === 'Light T');
    }
    await key229(page);
    await compEnd(page, 'Light Taupe ');
    await pause(page, 2200, 'longer than the box waits to clear text with nothing in it: typing must stay');
    assert.equal(await page.inputValue('#scBox'), 'Light Taupe ');
    assert.deepEqual(await list(page), ['E75']);
    assert.deepEqual(errors, []);
  });
  test('a pasted tray photo’s text: names on lines of their own under their codes aren’t asked about, plain words aren’t "not read"', async () => {
    const { page, errors } = await opened(IPAD_UA, 820, 1180);
    await page.evaluate((t) => {
      const d = new DataTransfer();
      d.setData('text/plain', t);
      document
        .getElementById('scBox')
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
    }, 'CG17\nAbalone\nBGY02\nPigeon\nGrey\nE75\nLight Rose\nTaupe\nSWE\nFY01\nFluorescent\nOrange\nn6ea\nCool Grey');
    await idle(page);
    assert.deepEqual(await list(page), ['FY01', 'E75', 'BGY02', 'CG17']);
    const stat = (await page.textContent('#scStat')).replace(/\s+/g, ' ');
    assert.match(stat, /4 added to the list/);
    assert.match(stat, /1 line not read/, stat); // n6ea: a digit in it
    assert.doesNotMatch(stat, /to choose/);
    assert.deepEqual(errors, []);
  });
}

// ---- from v318-adding-1a.test.mjs ----
// v318 review (adding markers, 1a): while the keyboard or Scan Text's camera is up (the box has focus, and what's seen
// of the page is shorter than the page: visualViewport), Scan's paste line and photo card go, and its steps once the
// list has a marker, so what was just read and the count stay above it. Fails on v318.
{
  const kbUp = (page, v) =>
    page.evaluate((v) => {
      if (v == null) delete visualViewport.height;
      else Object.defineProperty(visualViewport, 'height', { get: () => v, configurable: true });
      visualViewport.dispatchEvent(new Event('resize'));
    }, v);
  const shown = (page, id) =>
    page.evaluate((id) => document.getElementById(id).getClientRects().length > 0, id);
  for (const [W, H, panel] of [
    [390, 844, 330],
    [1180, 820, 400],
  ]) {
    test(`${W}×${H}: with a ${panel} px keyboard up, what was read and the count stay above it`, async () => {
      const { page, errors } = await openApp({
        width: W,
        height: H,
        storage: { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-scan-brand': '' },
      });
      await page.evaluate(() => openScan());
      await idle(page);
      await page.focus('#scBox');
      await page.keyboard.type('R014');
      await page.keyboard.press('Enter');
      await idle(page);
      assert.ok(await shown(page, 'scLens'), 'the paste line, with no keyboard');
      await kbUp(page, H - panel);
      assert.ok(
        !(await shown(page, 'scLens')) && !(await shown(page, 'ocrOpen')),
        'paste line and photo card gone',
      );
      const r = await page.evaluate(() => ({
        stat: document.getElementById('scStat').getBoundingClientRect().bottom,
        head: document.querySelector('.schead').getBoundingClientRect().bottom,
      }));
      assert.ok(r.stat <= H - panel && r.head <= H - panel, JSON.stringify(r));
      // the keyboard put away: all back
      await kbUp(page, null);
      assert.ok(await shown(page, 'scLens'));
      // the box let go of, the keyboard still reported up for a moment: back too
      await kbUp(page, H - panel);
      await page.evaluate(() => document.getElementById('scBox').blur());
      await idle(page);
      assert.ok(await shown(page, 'scLens'));
      assert.deepEqual(errors, []);
    });
  }
}

// ---- from v318-adding-9.test.mjs ----
// v318 review (adding markers, 9): smaller fixes in Scan and the photo reader. A brand tapped with nothing to answer says
// the brand now reading; Find mode leaves another brand's code out, with no Add; Scan closed after the toast's Open
// puts the keyboard back on Add markers; a paste too long for a list is said, not read; a set's name read quietly by
// Scan Text ("Honolulu 120") is the set's card, not Ohuhu's 120 Black, unless Black's name is read with it; Photograph
// your caps with the reader stored shows the reader under the picker; a batch stopped at its first photo is said as
// one photo. Fails on v318.
{
  const skip = { 'ms-onboarded': '1', 'ms-setup-tip': '1', 'ms-scan-brand': '' };
  const paste = (page, text) =>
    page.evaluate((t) => {
      const d = new DataTransfer();
      d.setData('text/plain', t);
      document
        .getElementById('scBox')
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: d }));
    }, text);
  const marks = (page) => page.evaluate(() => scanList.filter((e) => !e.ask).map((e) => mkey(e.i)));
  // (text arriving at once, as Scan Text puts it in: read quietly once it holds still)
  const quiet = async (page, t) => {
    await page.fill('#scBox', t);
    await page.waitForFunction(() => document.getElementById('scBox').value === '', null, { timeout: 5000 });
    await idle(page);
  };
  // a tray of caps, 1536×2048 (a JPEG): round caps, each a code over its name, turned any way, a little noise; n caps of
  // the brand from the colour list's first of that brand at `from`
  const tray = (page, brand, from, n, seed) =>
    page.evaluate(
      ([brand, from, n, seed]) => {
        const caps = COLORS.filter((c) => c.brand === brand && /^[A-Z]{1,3}\d{2,3}$/.test(c.code)).slice(
            from,
            from + n,
          ),
          W = 1536,
          H = 2048,
          cv = document.createElement('canvas');
        cv.width = W;
        cv.height = H;
        const g = cv.getContext('2d');
        g.fillStyle = '#2a2622';
        g.fillRect(0, 0, W, H);
        let s = seed;
        const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
        const R = 62,
          cols = Math.floor(W / (R * 2.2));
        caps.forEach((c, i) => {
          g.save();
          g.translate(R * 1.2 + (i % cols) * R * 2.2, R * 1.2 + Math.floor(i / cols) * R * 2.2);
          g.fillStyle = '#d9d6cf';
          g.beginPath();
          g.arc(0, 0, R + 6, 0, 7);
          g.fill();
          g.fillStyle = c.hex;
          g.beginPath();
          g.arc(0, 0, R, 0, 7);
          g.fill();
          g.rotate((r() - 0.5) * Math.PI * 2);
          g.fillStyle = '#222';
          g.textAlign = 'center';
          g.font = 'bold 26px Helvetica, Arial, sans-serif';
          g.fillText(c.code, 0, -4);
          g.font = '15px Helvetica, Arial, sans-serif';
          g.fillText(String(c.name).slice(0, 14), 0, 15);
          g.restore();
        });
        return {
          jpg: cv.toDataURL('image/jpeg', 0.92).split(',')[1],
          keys: caps.map((c) => c.brand + '|' + c.code),
        };
      },
      [brand, from, n, seed],
    );
  test('a brand tapped with nothing to answer: the card says the brand now reading', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
    await page.evaluate(() => openScan());
    await idle(page);
    await page.click('#scBrand [data-b="Ohuhu"]');
    assert.match(await page.textContent('#scStat'), /Ohuhu codes only/);
    await page.click('#scBrand [data-b="Copic"]');
    assert.match(await page.textContent('#scStat'), /Copic codes only/);
    assert.doesNotMatch(await page.textContent('#scStat'), /Ohuhu/);
    await page.click('#scBrand [data-b=""]');
    assert.match(await page.textContent('#scStat'), /Ohuhu and Copic codes/);
    assert.deepEqual(errors, []);
  });
  test('Find mode: another brand’s code is said, with no Add; in a list it’s left out, said', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180 });
    await page.click('#wcNotSure');
    await page.click('#wcFBrand [data-b="Ohuhu"]');
    await page.click('#wcFCount [data-n="1"]');
    await page.click('#wcFindNext');
    await idle(page);
    await page.fill('#scBox', 'E000');
    await page.keyboard.press('Enter');
    await idle(page);
    assert.match(await page.textContent('#scStat'), /Not an Ohuhu code: this looks for Ohuhu sets/);
    assert.equal(await page.$$eval('#scStat button', (b) => b.length), 0, 'no Add');
    await paste(page, 'R014\nBG314\nE000');
    await idle(page);
    assert.deepEqual((await marks(page)).sort(), ['Ohuhu|BG314', 'Ohuhu|R014']);
    assert.equal(await page.evaluate(() => scanList.filter((e) => e.ask).length), 0, 'not asked about');
    assert.match(await page.textContent('#scStat'), /1 not Ohuhu, left out/);
    assert.deepEqual(errors, []);
  });
  test('the toast’s Open, then Scan closed: the keyboard on Add markers', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
    await page.click('#mCollection');
    await idle(page);
    await scanFromMarkers(page);
    await page.fill('#scBox', 'R014');
    await page.keyboard.press('Enter');
    await page.fill('#scBox', 'Y28');
    await page.keyboard.press('Enter');
    await idle(page);
    await page.click('#scAdd');
    await idle(page);
    await page.click('#toastAct2');
    await idle(page);
    assert.ok(await page.isVisible('#scBox'), 'Scan open again');
    await page.click('#scClose');
    await idle(page);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'mkAddBtn');
    assert.deepEqual(errors, []);
  });
  test('a paste too long for a list of markers is said, not read', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
    await page.evaluate(() => openScan());
    await idle(page);
    await paste(page, 'R014 Y28 B04 shipping $12.99 '.repeat(8000));
    await idle(page);
    assert.match(await page.textContent('#scStat'), /Too much text for a list of markers/);
    assert.deepEqual(await marks(page), []);
    // a long list still is
    await paste(page, 'R014, 2 pcs, $3.49\n'.repeat(5000));
    await idle(page);
    assert.deepEqual(await marks(page), ['Ohuhu|R014']);
    assert.deepEqual(errors, []);
  });
  test('a set’s name read quietly: the set’s card, its size offered as a cap; with the cap’s name, that marker', async () => {
    const { page, errors } = await openApp({ width: 820, height: 1180, storage: skip });
    await page.evaluate(() => openScan());
    await idle(page);
    await quiet(page, 'HONOLULU 120');
    assert.deepEqual(await marks(page), [], 'not Black unasked');
    assert.match(await page.textContent('#scStat b'), /Honolulu 120/);
    const btns = await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent));
    assert.deepEqual(btns, ['Add all 120 to the list', 'Add 120 Black']);
    await page.click('#scStat .scpick button:text-is("Add 120 Black")');
    await idle(page);
    assert.deepEqual(await marks(page), ['Ohuhu|120']);
    // said as colours: the box, no cap offered
    await page.evaluate(() => {
      scanList = [];
      scanRender();
    });
    await quiet(page, 'OHUHU HONOLULU 48 COLORS');
    assert.deepEqual(await page.$$eval('#scStat .scpick button', (a) => a.map((b) => b.textContent)), [
      'Add all 48 to the list',
    ]);
    // the cap with its name: Black
    await quiet(page, 'HONOLULU 120 Black');
    assert.deepEqual(await marks(page), ['Ohuhu|120']);
    assert.deepEqual(errors, []);
  });
  test('Photograph your caps, the reader stored: its view under the picker; a batch stopped at its first photo, said as one', async () => {
    const { page, errors, ctx } = await openApp({ width: 820, height: 1180, storage: skip });
    await ctx.unrouteAll({ behavior: 'ignoreErrors' });
    await page.evaluate(() => openScan());
    await idle(page);
    await page.click('#ocrOpen');
    await page.click('#ocrGet');
    await page.waitForSelector('#ocrPick', { timeout: 60000 });
    await page.click('#ocrNo');
    await page.click('#scClose');
    await idle(page);
    // (from Markers' Add markers' Photograph your caps: the picker, and the reader's view under it)
    await page.click('#mCollection');
    await idle(page);
    const [fc] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.evaluate(() => openScan({ photo: true })),
    ]);
    assert.ok(await page.isVisible('#ocrPick'), 'Take or choose photos, under the picker');
    assert.equal(await page.isVisible('#scBox'), false);
    // three photos, Stop at once
    const t = await tray(page, 'Ohuhu', 20, 12, 5);
    const f = (n) => ({ name: n, mimeType: 'image/jpeg', buffer: Buffer.from(t.jpg, 'base64') });
    await fc.setFiles([f('a.jpg'), f('b.jpg'), f('c.jpg')]);
    await page.click('#ocrStop');
    await page.waitForSelector('#ocrDone', { timeout: 120000 });
    const say = await page.textContent('#ocrSay');
    assert.match(say, /stopped · the other 2 photos not read$/);
    assert.doesNotMatch(await page.textContent('#ocrSum'), /The last photo is shown/);
    assert.deepEqual(errors, []);
  });
}
