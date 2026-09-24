// Renders the PNG icons from the drop design. Run after changing it:  bun scripts/icons.mjs
// iOS ignores SVG home-screen icons, and Android wants 192/512 plus a "maskable" one with safe padding.
// Design: Squirtle theme — navy tile, sky-blue drop outline, water line at about half.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const NAVY = "#0b3a5c";
const SKY = "#7cc7e8";
const DROP = "M256 96c-64 96-128 168-128 240a128 128 0 0 0 256 0c0-72-64-144-128-240z";

// Full-bleed square for iOS (it rounds the corners itself) and maskable Android icons,
// the drop scaled into the safe zone.
const flat = (scale) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><clipPath id="d"><path d="${DROP}"/></clipPath></defs>` +
      `<rect width="512" height="512" fill="${NAVY}"/>` +
      `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">` +
      `<rect x="100" y="286" width="312" height="200" fill="${SKY}" clip-path="url(#d)"/>` +
      `<path d="${DROP}" fill="none" stroke="${SKY}" stroke-width="22" stroke-linejoin="round"/></g></svg>`,
  );

const svg = readFileSync("public/icon.svg");
await sharp(svg).resize(192, 192).png().toFile("public/icon-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/icon-512.png");
await sharp(flat(0.8)).resize(512, 512).png().toFile("public/icon-maskable-512.png");
await sharp(flat(0.9)).resize(180, 180).png().toFile("src/app/apple-icon.png");
console.log("icons written");
