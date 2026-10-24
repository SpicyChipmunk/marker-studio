// (v320) Made-up phone photos of a page, drawn in the page by eval'ing the source: shared by the tests that use them
// (two read them out of other test files' source before).
// GEN_STRAIGHTEN: a page on a table (from straighten.test.mjs). GEN_PAGE_PHOTO: a Letter page with the sample on it,
// on wood or a white table (from v314-page-photo.test.mjs).
export const GEN_STRAIGHTEN = String.raw`
async function makePhoto(o) {
  const W = o.W || 1200, H = o.H || 1600;
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = '/src/assets/sample-jellyfish.png'; });
  const PW = 850, PH = 1100, pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; const p = pg.getContext('2d');
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  p.fillStyle = '#f7f5ef'; p.fillRect(0, 0, PW, PH);
  if (o.bleed) { p.save(); p.beginPath(); p.rect(20, 20, PW - 40, PH - 40); p.clip(); p.strokeStyle = '#161616'; for (let i = 0; i < 420; i++) { p.lineWidth = 2 + rnd() * 5; p.beginPath(); p.ellipse(rnd() * PW, rnd() * PH, 8 + rnd() * 60, 8 + rnd() * 60, rnd() * 3, 0, 6.283); p.stroke(); } p.lineWidth = 5; p.strokeRect(20, 20, PW - 40, PH - 40); p.restore(); }
  else { const s = Math.min((PW - 160) / art.width, (PH - 200) / art.height); p.drawImage(art, (PW - art.width * s) / 2, (PH - art.height * s) / 2, art.width * s, art.height * s); }
  if (o.scan) { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, W, H); const s = Math.min(W / PW, H / PH) * 0.94; if (o.border) { g.strokeStyle = '#111'; g.lineWidth = 6; g.strokeRect(W * 0.05, H * 0.05, W * 0.9, H * 0.9); } g.drawImage(pg, (W - PW * s) / 2, (H - PH * s) / 2, PW * s, PH * s); return done(c, null); }
  const pd = p.getImageData(0, 0, PW, PH).data;
  const f = 25 / 43.27 * Math.hypot(W, H), tx = (o.tilt || 0) * Math.PI / 180, rz = (o.roll || 0) * Math.PI / 180, ry = (o.yaw || 0) * Math.PI / 180, sz = o.size || 0.8;
  const hw = 0.5 * 8.5, hh = 0.5 * 11, Z = (11 / sz) * f / H;
  const proj = (X, Y) => { let x = X, y = Y, z = 0, y1 = y * Math.cos(tx), z1 = y * Math.sin(tx); y = y1; z = z1; let x1 = x * Math.cos(ry) + z * Math.sin(ry); z1 = -x * Math.sin(ry) + z * Math.cos(ry); x = x1; z = z1; x1 = x * Math.cos(rz) - y * Math.sin(rz); y1 = x * Math.sin(rz) + y * Math.cos(rz); x = x1; y = y1; z += Z; return [W / 2 + (o.dx || 0) * W + f * x / z, H / 2 + (o.dy || 0) * H + f * y / z]; };
  const C = [proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)], Hm = __mstest.pgHomog(C, [[0, 0], [PW, 0], [PW, PH], [0, PH]]);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data, bg = o.bg || 'wood';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 4, den = Hm[6] * x + Hm[7] * y + 1, u = (Hm[0] * x + Hm[1] * y + Hm[2]) / den, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / den; let r, gg, b;
    if (u >= 0 && v >= 0 && u < PW - 1 && v < PH - 1) { const k = ((v | 0) * PW + (u | 0)) * 4; r = pd[k]; gg = pd[k + 1]; b = pd[k + 2]; }
    else if (bg === 'wood') { const t = Math.sin(x * 0.02 + Math.sin(y * 0.005) * 3) * 0.5 + 0.5; r = 120 + 50 * t; gg = 80 + 35 * t; b = 50 + 20 * t; }
    else if (bg === 'dark') { const t = rnd(); r = 50 + 30 * t; gg = 52 + 30 * t; b = 58 + 30 * t; }
    else { r = 238; gg = 236; b = 232; }
    const sh = 1 - 0.22 * (x / W * 0.6 + y / H * 0.4), nz = (rnd() - 0.5) * 12; d[j] = r * sh + nz; d[j + 1] = gg * sh + nz; d[j + 2] = b * sh + nz; d[j + 3] = 255; }
  g.putImageData(im, 0, 0); return done(c, C);
  async function done(c, C) { const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88)); const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); }); return { b64, C, W, H }; }
}`;
export const GEN_PAGE_PHOTO = String.raw`
async function makePhoto(o) {
  const W = 1200, H = 1600;
  const art = new Image(); await new Promise((r) => { art.onload = r; art.src = '/src/assets/sample-jellyfish.png'; });
  const PW = 850, PH = 1100, pg = document.createElement('canvas'); pg.width = PW; pg.height = PH; const p = pg.getContext('2d');
  let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  p.fillStyle = '#f7f5ef'; p.fillRect(0, 0, PW, PH);
  const s = Math.min((PW - 160) / art.width, (PH - 200) / art.height); p.drawImage(art, (PW - art.width * s) / 2, (PH - art.height * s) / 2, art.width * s, art.height * s);
  const pd = p.getImageData(0, 0, PW, PH).data;
  const f = 25 / 43.27 * Math.hypot(W, H), tx = (o.tilt || 0) * Math.PI / 180, rz = (o.roll || 0) * Math.PI / 180, sz = o.size || 0.8;
  const hw = 0.5 * 8.5, hh = 0.5 * 11, Z = (11 / sz) * f / H;
  const proj = (X, Y) => { let x = X, y = Y * Math.cos(tx), z = Y * Math.sin(tx); const x1 = x * Math.cos(rz) - y * Math.sin(rz), y1 = x * Math.sin(rz) + y * Math.cos(rz); return [W / 2 + f * x1 / (z + Z), H / 2 + f * y1 / (z + Z)]; };
  const C = [proj(-hw, -hh), proj(hw, -hh), proj(hw, hh), proj(-hw, hh)], Hm = __mstest.pgHomog(C, [[0, 0], [PW, 0], [PW, PH], [0, PH]]);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const j = (y * W + x) * 4, den = Hm[6] * x + Hm[7] * y + 1, u = (Hm[0] * x + Hm[1] * y + Hm[2]) / den, v = (Hm[3] * x + Hm[4] * y + Hm[5]) / den; let r, gg, b;
    if (u >= 0 && v >= 0 && u < PW - 1 && v < PH - 1) { const k = ((v | 0) * PW + (u | 0)) * 4; r = pd[k]; gg = pd[k + 1]; b = pd[k + 2]; }
    else if (o.bg === 'white') { r = 238; gg = 236; b = 232; }
    else { const t = Math.sin(x * 0.02 + Math.sin(y * 0.005) * 3) * 0.5 + 0.5; r = 120 + 50 * t; gg = 80 + 35 * t; b = 50 + 20 * t; }
    const sh = 1 - 0.22 * (x / W * 0.6 + y / H * 0.4), nz = (rnd() - 0.5) * 12; d[j] = r * sh + nz; d[j + 1] = gg * sh + nz; d[j + 2] = b * sh + nz; d[j + 3] = 255; }
  g.putImageData(im, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.88));
  const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(blob); });
  return { b64, C };
}`;
