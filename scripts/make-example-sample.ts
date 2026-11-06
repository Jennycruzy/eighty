// Makes Maria's made-up earnings summary for the example, as a one-page PDF and a
// PNG, in public/example/. Usage: pnpm exec tsx scripts/make-example-sample.ts [YYYY-MM-DD]
// The date sets the month shown; it defaults to today. The app makes its own
// copy for the current month when a visitor taps "Add Maria's sample".
import { mkdir, writeFile } from "node:fs/promises";

import sharp from "sharp";

import {
  exampleSamplePdf,
  exampleSampleSvg,
} from "../server/lib/example-sample.ts";
import { validDate } from "../server/rules/dates.ts";

const asOf = process.argv[2] ?? new Date().toISOString().slice(0, 10);
if (!validDate(asOf)) {
  console.error("Give the date as YYYY-MM-DD.");
  process.exit(1);
}
const folder = new URL("../public/example/", import.meta.url);
await mkdir(folder, { recursive: true });
await writeFile(
  new URL("maria-earnings-sample.pdf", folder),
  await exampleSamplePdf(asOf),
);
await writeFile(
  new URL("maria-earnings-sample.png", folder),
  await sharp(Buffer.from(exampleSampleSvg(asOf)))
    .png({ compressionLevel: 9 })
    .toBuffer(),
);
console.log(
  `Made public/example/maria-earnings-sample.pdf and .png for ${asOf}.`,
);
