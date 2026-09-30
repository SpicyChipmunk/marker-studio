// Records the guide's controls in a broad set of states (e2e/controls-states.mjs) so two versions of the code can be
// compared: a refactor of js/guide/50-controls.js must leave them exactly as they were.
//
//   node scripts/controls-compare.mjs capture DIR [options]   record the current index.html (or --root's) into DIR
//   node scripts/controls-compare.mjs compare DIR1 DIR2        compare two recordings; exit 1 on any difference
//
// What is recorded, in each state of each screen size and text size:
//   - markup: every string written into the controls (#sfCtl.innerHTML) since the last state, in order; every listener
//     added inside the controls, in order (where, which event, the handler's source); the controls' markup and the
//     bottom bar's (moved out of the controls by dockBar) once the app is idle
//   - --styles: every computed style property of every element in the controls and the bar (and of their ::before
//     and ::after), and each element's box
//   - --shots: a screenshot of the controls and of the bar (a separate run: a screenshot scrolls the page)
// A change meant to leave the markup alone (moving code into functions) must match everything; one that moves inline
// styles into classes changes the markup by design, so compare it with --no-markup: the styles, boxes and pixels
// must still match.
//
// Options for capture:
//   --root DIR          serve DIR/index.html instead of this checkout's (e.g. a `git worktree` of another commit)
//   --sizes a,b         screen sizes: phone (390×844), landscape (844×390, side by side), ipad (820×1180); default all
//   --scales a,b        text sizes (× 16px), default 1,1.3,1.6
//   --sessions a,b      only these sessions of e2e/controls-states.mjs
//   --styles, --shots   see above
// Chromium only (the text size is set through Chromium's font settings).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize, resolve } from 'node:path';
import * as pw from 'playwright';
import { ROOT, trackIdle, idle } from '../e2e/helpers.mjs';
import { SESSIONS, CTL_INIT } from '../e2e/controls-states.mjs';

const SIZES = { phone: [390, 844], landscape: [844, 390], ipad: [820, 1180] };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i < 0 ? def : process.argv[i + 1];
}
const flag = (name) => process.argv.includes(name);

async function serve(root) {
  const srv = createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) return res.writeHead(403).end();
    try {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => new Promise((r) => srv.close(r)) };
}

// the parts of a recording that differ between runs for reasons of their own: a photo's blob: URL, the server's port
const tidy = (s, url) => (s == null ? s : s.split(url).join('/').replace(/blob:[^"' )]+/g, 'blob:*'));

// In the page: the computed styles and boxes of the controls and the bar, in document order. Two things that differ
// from run to run for reasons of their own are evened out first: an endless animation (Colour along's shimmer) is
// read at its start, and the boxes are measured with the page scrolled to the top (where the page happened to be
// scrolled moves the pinned tabs and the bar), then the scroll is put back.
function styleSnapshot() {
  const ctl = document.getElementById('sfCtl'),
    work = document.getElementById('sfWork'),
    bar = work && work.querySelector(':scope>.sfbar');
  for (const a of document.getAnimations()) {
    const t = a.effect && a.effect.getComputedTiming();
    if (t && t.iterations === Infinity) a.currentTime = 0;
  }
  const els = [];
  for (const root of [ctl, bar]) if (root) els.push(root, ...root.querySelectorAll('*'));
  const all = (cs) => {
    let s = '';
    for (let i = 0; i < cs.length; i++) s += cs[i] + ':' + cs.getPropertyValue(cs[i]) + ';';
    return s;
  };
  const r4 = (v) => Math.round(v * 64) / 64,
    x0 = scrollX,
    y0 = scrollY;
  scrollTo(0, 0);
  const out = els.map((el) => {
    const b = el.getBoundingClientRect(),
      bf = getComputedStyle(el, '::before'),
      af = getComputedStyle(el, '::after');
    return [
      el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
      all(getComputedStyle(el)),
      bf.content === 'none' ? '' : all(bf),
      af.content === 'none' ? '' : all(af),
      el.getClientRects().length ? [r4(b.left), r4(b.top), r4(b.width), r4(b.height)].join(',') : 'no box',
    ];
  });
  scrollTo(x0, y0);
  return out;
}

async function capture(dir) {
  const root = resolve(arg('--root', ROOT));
  if (!existsSync(join(root, 'index.html'))) throw new Error('no index.html in ' + root);
  const sizes = arg('--sizes', 'phone,landscape,ipad').split(',');
  const scales = arg('--scales', '1,1.3,1.6').split(',').map(Number);
  const only = arg('--sessions', '');
  const sessions = SESSIONS.filter((s) => !only || only.split(',').includes(s.name));
  const styles = flag('--styles'),
    shots = flag('--shots');
  await mkdir(dir, { recursive: true });
  const server = await serve(root),
    browser = await pw.chromium.launch();
  try {
    for (const size of sizes)
      for (const scale of scales) {
        const key = size + '-' + scale,
          out = { states: {}, table: [] },
          index = new Map();
        const ref = (s) => {
          if (!index.has(s)) {
            index.set(s, out.table.length);
            out.table.push(s);
          }
          return index.get(s);
        };
        if (shots) await mkdir(join(dir, 'shots', key), { recursive: true });
        for (const ses of sessions) {
          const [width, height] = SIZES[size];
          const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: false });
          await trackIdle(ctx);
          await ctx.addInitScript(CTL_INIT);
          await ctx.addInitScript((st) => {
            window.__MS_TEST = true;
            if (st && !sessionStorage.getItem('__seeded')) {
              for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v);
              sessionStorage.setItem('__seeded', '1');
            }
          }, ses.storage);
          await ctx.route((u) => !u.href.startsWith(server.url), (r) => r.abort());
          const page = await ctx.newPage(),
            errors = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await page.goto(server.url);
          if (scale !== 1) {
            const cdp = await ctx.newCDPSession(page);
            await cdp.send('Page.setFontSizes', { fontSizes: { standard: Math.round(16 * scale) } });
            await page.reload();
          }
          await idle(page);
          const cap = async (name) => {
            const k = ses.name + '/' + name;
            if (k in out.states) throw new Error('two states called ' + k);
            const r = await page.evaluate(() => {
              const c = document.getElementById('sfCtl'),
                w = document.getElementById('sfWork'),
                bar = w && w.querySelector(':scope>.sfbar');
              return { ...window.__ctlTake(), html: c ? c.innerHTML : null, bar: bar ? bar.outerHTML : null };
            });
            const st = {
              writes: r.writes.map((s) => tidy(s, server.url)),
              listen: r.listen,
              html: tidy(r.html, server.url),
              bar: tidy(r.bar, server.url),
            };
            if (styles) st.styles = (await page.evaluate(styleSnapshot)).map(([id, s, b, a, box]) => [id, ref(s), b ? ref(b) : -1, a ? ref(a) : -1, box]);
            if (shots) {
              // taken from the top of the page (where it happened to be scrolled decides where the pinned tabs and
              // the bar sit over the controls), without a toast (whether one is still up depends on how long the
              // steps took) and, for the controls, without the bar over them
              const y = await page.evaluate(() => scrollY);
              const file = (w) => join(dir, 'shots', key, k.replace('/', '--') + w + '.png');
              const opt = { animations: 'disabled', caret: 'hide', style: '#msToast { visibility: hidden !important; }' };
              const c = page.locator('#sfCtl');
              await page.evaluate(() => scrollTo(0, 0));
              if (await c.isVisible()) await c.screenshot({ ...opt, path: file(''), style: opt.style + ' #sfWork > .sfbar { visibility: hidden !important; }' });
              await page.evaluate(() => scrollTo(0, 0));
              const b = page.locator('#sfWork > .sfbar');
              if ((await b.count()) && (await b.isVisible())) await b.screenshot({ ...opt, path: file('-bar') });
              await page.evaluate((y) => scrollTo(0, y), y);
              await idle(page);
            }
            out.states[k] = st;
          };
          await ses.run(page, cap, idle);
          if (errors.length) throw new Error(key + ' ' + ses.name + ': page errors: ' + errors.join(' | '));
          await ctx.close();
        }
        await writeFile(join(dir, key + '.json'), JSON.stringify(out));
        console.log(key + ': ' + Object.keys(out.states).length + ' states');
      }
  } finally {
    await browser.close();
    await server.close();
  }
}

// the first difference between two lists, described
function firstDiff(a, b, what) {
  if (a.length !== b.length) return `${what}: ${a.length} vs ${b.length} entries`;
  for (let i = 0; i < a.length; i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return `${what}[${i}]: ${JSON.stringify(a[i]).slice(0, 300)}\n   vs ${JSON.stringify(b[i]).slice(0, 300)}`;
  return '';
}
function styleDiff(sa, sb) {
  const pa = new Map(sa.split(';').map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)])),
    pb = new Map(sb.split(';').map((d) => [d.slice(0, d.indexOf(':')), d.slice(d.indexOf(':') + 1)]));
  const out = [];
  for (const k of new Set([...pa.keys(), ...pb.keys()])) if (pa.get(k) !== pb.get(k)) out.push(`${k}: ${pa.get(k)} -> ${pb.get(k)}`);
  return out.join('; ');
}

async function compare(d1, d2) {
  const markup = !flag('--no-markup');
  const files = (await readdir(d1)).filter((f) => f.endsWith('.json'));
  let bad = 0,
    states = 0,
    els = 0,
    shotsSame = 0;
  // the first differences in full, then how many there are in each state
  const per = new Map();
  const say = (m) => {
    bad++;
    if (bad <= 40) console.log(m);
    const k = m.split(/:? /).slice(0, 2).join(' ');
    per.set(k, (per.get(k) || 0) + 1);
  };
  for (const f of files) {
    const A = JSON.parse(await readFile(join(d1, f), 'utf8')),
      B = JSON.parse(await readFile(join(d2, f), 'utf8'));
    const ka = Object.keys(A.states),
      kb = Object.keys(B.states);
    if (ka.join() !== kb.join()) say(`${f}: different states\n  ${ka.join()}\n  ${kb.join()}`);
    for (const k of ka) {
      const a = A.states[k],
        b = B.states[k];
      if (!b) continue;
      states++;
      if (markup)
        for (const part of ['writes', 'listen', 'html', 'bar']) {
          const x = [].concat(a[part]),
            y = [].concat(b[part]);
          const d = firstDiff(x, y, part);
          if (d) say(`${f} ${k}: ${d}`);
        }
      if (a.styles || b.styles) {
        if (!a.styles || !b.styles || a.styles.length !== b.styles.length) {
          say(`${f} ${k}: ${a.styles && a.styles.length} vs ${b.styles && b.styles.length} elements`);
          continue;
        }
        for (let i = 0; i < a.styles.length; i++) {
          const [ida, sa, ba, aa, boxa] = a.styles[i],
            [idb, sb, bb, ab, boxb] = b.styles[i];
          els++;
          if (ida !== idb) say(`${f} ${k} element ${i}: ${ida} vs ${idb}`);
          if (boxa !== boxb) say(`${f} ${k} ${ida} (${i}): box ${boxa} vs ${boxb}`);
          const pairs = [['', sa, sb], ['::before', ba, bb], ['::after', aa, ab]];
          for (const [w, x, y] of pairs) {
            const tx = x < 0 ? '' : A.table[x],
              ty = y < 0 ? '' : B.table[y];
            // (compared property by property: custom properties can be listed in another order)
            const d = tx === ty ? '' : styleDiff(tx, ty);
            if (d) say(`${f} ${k} ${ida}${w} (${i}): ${d}`);
          }
        }
      }
    }
  }
  // screenshots: the same bytes, or else the same pixels
  const s1 = join(d1, 'shots'),
    s2 = join(d2, 'shots');
  if (existsSync(s1) && existsSync(s2)) {
    let browser = null;
    for (const key of await readdir(s1))
      for (const f of await readdir(join(s1, key))) {
        const p2 = join(s2, key, f);
        if (!existsSync(p2)) {
          say(`shot ${key}/${f}: missing in ${d2}`);
          continue;
        }
        const a = await readFile(join(s1, key, f)),
          b = await readFile(p2);
        if (a.equals(b)) {
          shotsSame++;
          continue;
        }
        browser ??= await pw.chromium.launch();
        const page = await browser.newPage();
        const d = await page.evaluate(
          async ([a, b]) => {
            const load = async (s) => {
              const im = new Image();
              im.src = 'data:image/png;base64,' + s;
              await im.decode();
              const c = document.createElement('canvas');
              c.width = im.width;
              c.height = im.height;
              const g = c.getContext('2d');
              g.drawImage(im, 0, 0);
              return g.getImageData(0, 0, c.width, c.height);
            };
            const x = await load(a),
              y = await load(b);
            if (x.width !== y.width || x.height !== y.height) return `size ${x.width}×${x.height} vs ${y.width}×${y.height}`;
            let n = 0;
            for (let i = 0; i < x.data.length; i += 4)
              if (x.data[i] !== y.data[i] || x.data[i + 1] !== y.data[i + 1] || x.data[i + 2] !== y.data[i + 2] || x.data[i + 3] !== y.data[i + 3]) n++;
            return n ? n + ' pixels differ' : '';
          },
          [a.toString('base64'), b.toString('base64')],
        );
        await page.close();
        if (d) say(`shot ${key}/${f}: ${d}`);
        else shotsSame++;
      }
    if (browser) await browser.close();
  }
  if (bad > 40) for (const [k, n] of per) console.log(`  ${n} in ${k}`);
  console.log(`${files.length} recordings, ${states} states, ${els} elements styled, ${shotsSame} screenshots identical: ${bad ? bad + ' differences' : 'no differences'}`);
  if (bad) process.exit(1);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'capture' && a) await capture(resolve(a));
else if (cmd === 'compare' && a && b) await compare(resolve(a), resolve(b));
else {
  console.log('usage: node scripts/controls-compare.mjs capture DIR [--root DIR] [--sizes ..] [--scales ..] [--sessions ..] [--styles] [--shots]\n       node scripts/controls-compare.mjs compare DIR1 DIR2 [--no-markup]');
  process.exit(2);
}
