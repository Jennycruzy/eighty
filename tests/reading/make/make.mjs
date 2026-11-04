// Makes every test document in tests/reading/documents (or in --out DIR).
//   node tests/reading/make/make.mjs [--out DIR] [--only ID]
// The pictures use only the Liberation Sans fonts that ship inside pdfjs-dist, through a private
// fontconfig file, so the output does not depend on the fonts installed on the machine.
// Same platform and same package versions give the same bytes; the unit tests check this.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/package.json"))), "standard_fonts");

// The first run writes the font settings and starts this script again with --fonts-ready.
if (!process.argv.includes("--fonts-ready")) {
  // Start again with a fontconfig file that knows only the bundled fonts.
  const work = await mkdtemp(path.join(tmpdir(), "eighty-reading-fonts-"));
  const config = path.join(work, "fonts.conf");
  await writeFile(
    config,
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig><dir>${FONT_DIR}</dir><cachedir>${path.join(work, "cache")}</cachedir></fontconfig>\n`,
  );
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--fonts-ready"], {
    stdio: "inherit",
    env: { ...process.env, FONTCONFIG_FILE: config },
  });
  process.exit(child.status ?? 1);
}

const { default: sharp } = await import("sharp");
const { toPdf, toSvg } = await import("./draw.mjs");
const { documents, draw, fileName } = await import("./catalog.mjs");

const SCALE = 2;
sharp.cache(false);
sharp.concurrency(1);

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const outDir = path.resolve(option("--out") ?? path.join(here, "..", "documents"));
const only = option("--only");

const px = (value) => Math.round(value * SCALE);
const png = (image) => image.png({ compressionLevel: 9 }).toBuffer();

async function blur(buffer, regions) {
  const layers = [];
  for (const region of regions) {
    const box = { left: px(region.x), top: px(region.y), width: px(region.w), height: px(region.h) };
    layers.push({ input: await sharp(buffer).extract(box).blur(14).toBuffer(), left: box.left, top: box.top });
  }
  return png(sharp(buffer).composite(layers));
}

// A phone screen photographed at an angle: fine stripes from the screen, a glare patch, a dark frame.
async function screenPhoto(buffer) {
  const { width, height } = await sharp(buffer).metadata();
  const stripes = Array.from({ length: Math.ceil(height / 5) }, (_, i) =>
    `<line x1="0" y1="${i * 5}" x2="${width}" y2="${i * 5 + 18}" stroke="#000000" stroke-opacity="0.08" stroke-width="1.6"/>`,
  ).join("");
  const glare = `<defs><radialGradient id="g" cx="0.28" cy="0.22" r="0.45"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/>`;
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${stripes}${glare}</svg>`);
  let image = await png(sharp(buffer).composite([{ input: overlay }]));
  image = await png(sharp(image).extend({ top: 70, bottom: 90, left: 36, right: 36, background: "#161616" }));
  image = await png(sharp(image).affine([[1, 0.07], [0.035, 1]], { background: "#4a4440", interpolator: "bicubic" }));
  image = await png(sharp(image).rotate(-4, { background: "#4a4440" }));
  return png(sharp(image).modulate({ brightness: 0.9, saturation: 0.85 }));
}

// A paper letter photographed on a table, slightly turned, with darker corners.
async function paperPhoto(buffer) {
  let image = await png(sharp(buffer).extend({ top: 80, bottom: 80, left: 80, right: 80, background: "#6b5a48" }));
  image = await png(sharp(image).rotate(3.5, { background: "#6b5a48" }));
  const { width, height } = await sharp(image).metadata();
  const shade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="v" cx="0.5" cy="0.45" r="0.75"><stop offset="0.55" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.45"/></radialGradient></defs><rect width="${width}" height="${height}" fill="url(#v)"/></svg>`,
  );
  image = await png(sharp(image).composite([{ input: shade }]));
  return png(sharp(image).resize({ width: Math.round(width * 0.8) }).modulate({ brightness: 0.95 }));
}

async function applyEffects(buffer, document, regions, sheet) {
  for (const effect of document.effects ?? []) {
    if (effect.kind === "blur") buffer = await blur(buffer, effect.regions(regions));
    else if (effect.kind === "rotate") buffer = await png(sharp(buffer).rotate(effect.angle, { background: "#ffffff" }));
    else if (effect.kind === "dark") buffer = await png(sharp(buffer).linear(0.3, 4));
    else if (effect.kind === "crop") {
      const box = effect.box(regions, sheet);
      buffer = await png(sharp(buffer).extract({ left: px(box.x), top: px(box.y), width: px(box.w), height: px(box.h) }));
    } else if (effect.kind === "screen") buffer = await screenPhoto(buffer);
    else if (effect.kind === "photo") buffer = await paperPhoto(buffer);
    else throw new Error(`Unknown effect ${effect.kind}`);
  }
  return buffer;
}

export async function render(document) {
  const { sheets, regions } = await draw(document);
  if (document.format === "pdf") return toPdf(sheets, document.id);
  if (sheets.length !== 1) throw new Error(`${document.id}: pictures have one page`);
  const base = await png(sharp(Buffer.from(await toSvg(sheets[0], SCALE))));
  const spoiled = await applyEffects(base, document, regions, sheets[0]);
  if (document.format === "png") return spoiled;
  return sharp(spoiled).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}

await mkdir(outDir, { recursive: true });
for (const document of documents) {
  if (only && document.id !== only) continue;
  const bytes = await render(document);
  await writeFile(path.join(outDir, fileName(document)), bytes);
  console.log(`${createHash("sha256").update(bytes).digest("hex")}  ${fileName(document)}`);
}
