/* Generate PWA icons locally — zero dependencies (PNG via zlib). */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'icons');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x / size, y / size);
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function makeIcon(size, { rounded, padding }) {
  const radius = rounded ? 0.23 : 0;
  const stroke = size < 200 ? 0.058 : 0.055;
  const pts = [
    [0.315, 0.525], [0.445, 0.655], [0.705, 0.365]
  ].map(([x, y]) => [
    0.5 + (x - 0.5) * (1 - padding * 2),
    y
  ]);

  return png(size, (u, v) => {
    // rounded square mask
    const dx = Math.max(radius - u, u - (1 - radius), 0);
    const dy = Math.max(radius - v, v - (1 - radius), 0);
    if (Math.hypot(dx, dy) > radius) return [0, 0, 0, 0];

    // diagonal gradient #6366f1 -> #a855f7
    const t = Math.max(0, Math.min(1, (u + v) / 2));
    const r = Math.round(99 + (168 - 99) * t);
    const g = Math.round(102 + (85 - 102) * t);
    const b = Math.round(241 + (247 - 241) * t);

    // soft top-left highlight
    const light = Math.max(0, 0.18 - Math.hypot(u - 0.25, v - 0.2) * 0.5);
    const rr = Math.min(255, Math.round(r + light * 255));
    const gg = Math.min(255, Math.round(g + light * 255));
    const bb = Math.min(255, Math.round(b + light * 255));

    // white checkmark
    const d = Math.min(
      distToSegment(u, v, pts[0][0], pts[0][1], pts[1][0], pts[1][1]),
      distToSegment(u, v, pts[1][0], pts[1][1], pts[2][0], pts[2][1])
    );
    if (d < stroke) {
      const edge = Math.max(0, Math.min(1, (stroke - d) / 0.008));
      return [255, 255, 255, Math.round(255 * edge)];
    }
    return [rr, gg, bb, 255];
  });
}

fs.mkdirSync(OUT, { recursive: true });

const jobs = [
  ['icon-192.png', 192, { rounded: true, padding: 0 }],
  ['icon-512.png', 512, { rounded: true, padding: 0 }],
  ['icon-512-maskable.png', 512, { rounded: false, padding: 0.1 }],
  ['apple-touch-icon.png', 180, { rounded: false, padding: 0.06 }]
];

for (const [name, size, opts] of jobs) {
  const buf = makeIcon(size, opts);
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log(`✓ ${name} (${size}x${size}, ${(buf.length / 1024).toFixed(1)} KB)`);
}
