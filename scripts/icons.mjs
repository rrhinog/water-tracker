// Renders the PNG icons from public/icon.svg. Run after changing the icon:  bun scripts/icons.mjs
// iOS ignores SVG home-screen icons, and Android wants 192/512 plus a "maskable" one with safe padding.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icon.svg");
const INK = "#111111";

// Full-bleed square for iOS (it rounds the corners itself) and maskable Android icons:
// the rounded-rect background is replaced by a flat square, the drop scaled into the safe zone.
const flat = (scale) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${INK}"/>` +
      `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)"><path d="M256 96c-64 96-128 168-128 240a128 128 0 0 0 256 0c0-72-64-144-128-240z" fill="#f5f5f3"/></g></svg>`,
  );

await sharp(svg).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/icon-512.png");
await sharp(flat(0.8)).resize(512, 512).png().toFile("public/icon-maskable-512.png");
await sharp(flat(0.9)).resize(180, 180).png().toFile("src/app/apple-icon.png");
console.log("icons written");
