// Makes Maria's made-up earnings summary for the demo, as a one-page PDF and a
// PNG, in public/demo/. Usage: pnpm exec tsx scripts/make-demo-sample.ts [YYYY-MM-DD]
// The date sets the month shown; it defaults to today. The app makes its own
// copy for the current month when a visitor taps "Add Maria's sample".
import { mkdir, writeFile } from "node:fs/promises";

import sharp from "sharp";

import { demoSamplePdf, demoSampleSvg } from "../server/lib/demo-sample.ts";
import { validDate } from "../server/rules/dates.ts";

const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!validDate(asOf)) {
  console.error("Give the date as YYYY-MM-DD.");
  process.exit(1);
}
const folder = new URL("../public/demo/", import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(
  new URL("maria-earnings-sample.pdf", folder),
  await demoSamplePdf(asOf),
);
await writeFile(
  new URL("maria-earnings-sample.png", folder),
  await sharp(Buffer.from(demoSampleSvg(asOf)))
    .png({ compressionLevel: 9 })
    .toBuffer(),
);
console.log(`Made public/demo/maria-earnings-sample.pdf and .png for ${asOf}.`);
