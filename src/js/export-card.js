/* export image */
function roundRect(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}
function mix(a, b, t) {
  const A = rgb(a),
    B = rgb(b);
  return (
    'rgb(' +
    Math.round(A[0] + (B[0] - A[0]) * t) +
    ',' +
    Math.round(A[1] + (B[1] - A[1]) * t) +
    ',' +
    Math.round(A[2] + (B[2] - A[2]) * t) +
    ')'
  );
}
function trunc(x, s, max) {
  if (x.measureText(s).width <= max) return s;
  while (s.length && x.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}
async function makeCard(idxs, kind) {
  const scale = 2,
    W = 600,
    pad = 44,
    gap = 12,
    headerH = 132,
    footerH = 54;
  // the brand is always on the card: one brand is said once under the title; mixed ones get their letter on each marker (a
  // row names its brand in full) and the letter key under the title
  const dom = COLORS[idxs[0]].hex,
    few = idxs.length <= 8,
    brands = brandsIn(idxs),
    one = brandLine(brands),
    sub =
      idxs.length +
      ' colour' +
      (idxs.length > 1 ? 's' : '') +
      (one ? ' · ' + one : !few && brands.length > 1 ? ' · ' + brandKey().replace(/\s{2,}/g, '  ') : '');
  let bodyH, cols, cellW, sqH, rowH;
  if (few) {
    rowH = 76;
    bodyH = idxs.length * rowH;
  } else {
    cols = Math.max(5, Math.min(7, Math.floor((W - 2 * pad) / 84)));
    cellW = (W - 2 * pad - gap * (cols - 1)) / cols;
    sqH = cellW * 0.8;
    const rows = Math.ceil(idxs.length / cols);
    bodyH = rows * (sqH + 20) + (rows - 1) * gap;
  }
  const H = headerH + bodyH + footerH;
  const cv = document.createElement('canvas');
  cv.width = W * scale;
  cv.height = H * scale;
  const x = cv.getContext('2d');
  x.scale(scale, scale);
  x.fillStyle = mix('#0c0c10', dom, 0.06);
  x.fillRect(0, 0, W, H);
  let g = x.createRadialGradient(W * 0.5, -H * 0.05, 0, W * 0.5, -H * 0.05, W * 0.95);
  g.addColorStop(0, rgba(dom, 0.3));
  g.addColorStop(1, rgba(dom, 0));
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  g = x.createRadialGradient(W * 0.5, H * 0.55, H * 0.28, W * 0.5, H * 0.55, H * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  g = x.createLinearGradient(0, 0, W * 0.7, H * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,.07)');
  g.addColorStop(0.45, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  try {
    await document.fonts.ready;
  } catch (e) {}
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  x.fillStyle = 'rgba(244,242,236,.5)';
  x.font = '600 12px "Hanken Grotesk", system-ui, sans-serif';
  try {
    x.letterSpacing = '2px';
  } catch (e) {}
  x.fillText('MARKER STUDIO', pad, pad + 14);
  try {
    x.letterSpacing = '0px';
  } catch (e) {}
  x.fillStyle = '#f5f3ee';
  x.font = '500 34px Fraunces, Georgia, serif';
  x.fillText(kind === 'palette' ? HARM[state.harmony] + ' palette' : 'Drawn markers', pad, pad + 54);
  x.fillStyle = 'rgba(244,242,236,.5)';
  x.font = '400 15px "Hanken Grotesk", system-ui, sans-serif';
  x.fillText(trunc(x, sub, W - 2 * pad), pad, pad + 78);
  let y = headerH;
  if (few) {
    for (const i of idxs) {
      const c = COLORS[i],
        tc = txt(c.hex);
      roundRect(x, pad, y, 150, 64, 13);
      x.fillStyle = c.hex;
      x.fill();
      const sg = x.createLinearGradient(pad, y, pad, y + 64);
      sg.addColorStop(0, 'rgba(255,255,255,.20)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0)');
      roundRect(x, pad, y, 150, 64, 13);
      x.fillStyle = sg;
      x.fill();
      x.fillStyle = tc;
      x.font = '500 22px Fraunces, Georgia, serif';
      x.textAlign = 'left';
      x.fillText(c.code, pad + 16, y + 41);
      x.fillStyle = '#f2efe9';
      x.font = '500 17px "Hanken Grotesk", system-ui, sans-serif';
      x.fillText(trunc(x, c.name, W - pad - (pad + 172) - 78), pad + 172, y + 30);
      x.fillStyle = 'rgba(244,242,236,.5)';
      x.font = '500 13px "Hanken Grotesk", system-ui, sans-serif';
      x.fillText(c.brand, pad + 172, y + 50);
      x.fillStyle = 'rgba(244,242,236,.5)';
      x.font = '14px "Hanken Grotesk", system-ui, sans-serif';
      x.textAlign = 'right';
      x.fillText(c.hex.toUpperCase(), W - pad, y + 41);
      x.textAlign = 'left';
      y += rowH;
    }
  } else {
    let col = 0,
      cx = pad;
    for (const i of idxs) {
      const c = COLORS[i];
      roundRect(x, cx, y, cellW, sqH, 9);
      x.fillStyle = c.hex;
      x.fill();
      const sg = x.createLinearGradient(cx, y, cx, y + sqH);
      sg.addColorStop(0, 'rgba(255,255,255,.18)');
      sg.addColorStop(0.5, 'rgba(255,255,255,0)');
      roundRect(x, cx, y, cellW, sqH, 9);
      x.fillStyle = sg;
      x.fill();
      x.fillStyle = 'rgba(244,242,236,.72)';
      x.font = '600 10px "Hanken Grotesk", system-ui, sans-serif';
      x.textAlign = 'center';
      x.fillText((one ? '' : bTag(c.brand) + ' ') + c.code, cx + cellW / 2, y + sqH + 14);
      x.textAlign = 'left';
      col++;
      if (col >= cols) {
        col = 0;
        cx = pad;
        y += sqH + 20 + gap;
      } else cx += cellW + gap;
    }
  }
  x.strokeStyle = 'rgba(255,255,255,.1)';
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(pad, H - 38);
  x.lineTo(W - pad, H - 38);
  x.stroke();
  x.fillStyle = 'rgba(244,242,236,.42)';
  x.font = '13px "Hanken Grotesk", system-ui, sans-serif';
  x.textAlign = 'left';
  x.fillText('Made with Marker Studio', pad, H - 16);
  return cv.toDataURL('image/png');
}
function showOverlay(url, fname) {
  cardImg.src = url;
  dlLink.href = url;
  dlLink.download = fname;
  openDialog(imgOverlay);
}
function closeOverlay() {
  closeDialog(imgOverlay);
  cardImg.src = '';
}
