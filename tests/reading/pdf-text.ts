// Pulls the text out of a PDF with pdfjs-dist, one string per page, lines in reading order.
// No scripts run and no fonts load from the network.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const fontDir = `${path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts")}${path.sep}`;

interface TextItem {
  str: string;
  transform: number[];
}

export async function pdfText(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    standardFontDataUrl: fontDir,
    verbosity: 0,
  });
  const document = await task.promise;
  const pages: string[] = [];
  try {
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const items = (content.items as TextItem[]).filter((item) => typeof item.str === "string" && item.str.trim());
      // Group pieces that share a baseline, top to bottom, then left to right.
      const rows = new Map<number, TextItem[]>();
      for (const item of items) {
        const y = Math.round(item.transform[5]);
        const key = [...rows.keys()].find((existing) => Math.abs(existing - y) <= 2) ?? y;
        rows.set(key, [...(rows.get(key) ?? []), item]);
      }
      const lines = [...rows.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, row]) =>
          row
            .sort((a, b) => a.transform[4] - b.transform[4])
            .map((item) => item.str.trim())
            .join("  "),
        );
      pages.push(lines.join("\n"));
    }
  } finally {
    await task.destroy();
  }
  return pages;
}
