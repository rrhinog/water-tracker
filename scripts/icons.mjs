// Renders every app icon from the Baseline design. Run after changing it:  bun scripts/icons.mjs
// iOS ignores SVG home-screen icons and wants an opaque 180 x 180 PNG; Android wants 192/512 plus a
// "maskable" one with safe padding; browsers take the favicon.
// Design: Baseline — a mint tile, a dark line, and four red marks rising above it.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const TILE = "#c9ebd8";
const LINE = "#0f3b3a";
const MARKS = "#d93a25";

// The emblem on a 180 x 180 grid.
const EMBLEM =
  `<g transform="translate(0 9)"><rect x="24" y="118" width="132" height="17" rx="8.5" fill="${LINE}"/>` +
  [[44, 94], [73, 76], [102, 58], [131, 40]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="13" fill="${MARKS}"/>`).join("") +
  `</g>`;

// A full-bleed opaque square (iOS rounds the corners itself), the emblem scaled about the centre:
// 1 as drawn, less for the maskable icon so it stays inside Android's safe zone.
const square = (scale = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">` +
  `<rect width="180" height="180" fill="${TILE}"/>` +
  `<g transform="translate(90 90) scale(${scale}) translate(-90 -90)">${EMBLEM}</g></svg>\n`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).flatten({ background: TILE }).png().toBuffer();
// ICO readers want RGBA images; the tile is still fully opaque.
const rgba = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).flatten({ background: TILE }).ensureAlpha(1).png().toBuffer();

/** A .ico holding PNG images (supported by every current browser). */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((im) => im.data)]);
}

writeFileSync("public/icon.svg", square());
writeFileSync("public/icon-192.png", await png(square(), 192));
writeFileSync("public/icon-512.png", await png(square(), 512));
writeFileSync("public/icon-maskable-512.png", await png(square(0.8), 512));
writeFileSync("src/app/apple-icon.png", await png(square(), 180));
writeFileSync("src/app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await rgba(square(), size) })))));
console.log("icons written");
