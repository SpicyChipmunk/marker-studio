// A minimal PDF writer (scripts/bench): one full-page grey image per page (8-bit, Flate), Letter, nothing else.
import zlib from 'node:zlib';

// pages: [{w, h (pixels), grey (Uint8Array w*h)}]; paper in points (Letter 612 x 792)
export function pdfOfImages(pages, paper = { w: 612, h: 792 }) {
  const objs = [];
  const add = (body) => {
    objs.push(body);
    return objs.length;
  };
  const catalogId = add(null),
    pagesId = add(null),
    kids = [];
  for (const pg of pages) {
    const data = zlib.deflateSync(Buffer.from(pg.grey.buffer, pg.grey.byteOffset, pg.grey.byteLength), {
      level: 9,
    });
    const imId = add(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width ${pg.w} /Height ${pg.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>\nstream\n`,
        ),
        data,
        Buffer.from('\nendstream'),
      ]),
    );
    const cs = `q ${paper.w} 0 0 ${paper.h} 0 0 cm /Im0 Do Q`;
    const csId = add(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${paper.w} ${paper.h}] /Resources << /XObject << /Im0 ${imId} 0 R >> >> /Contents ${csId} 0 R >>`,
      ),
    );
  }
  objs[catalogId - 1] =
    `<< /Type /Catalog /Pages ${pagesId} 0 R /ViewerPreferences << /PrintScaling /None >> >>`;
  objs[pagesId - 1] =
    `<< /Type /Pages /Kids [${kids.map((k) => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
  const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'binary')],
    offs = [];
  let len = parts[0].length;
  objs.forEach((o, i) => {
    offs.push(len);
    const b = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      Buffer.isBuffer(o) ? o : Buffer.from(o),
      Buffer.from('\nendobj\n'),
    ]);
    parts.push(b);
    len += b.length;
  });
  const xref =
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${len}\n%%EOF\n`;
  parts.push(Buffer.from(xref));
  return Buffer.concat(parts);
}
