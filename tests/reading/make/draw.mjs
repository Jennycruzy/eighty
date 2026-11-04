// Draws one page description two ways: as an SVG that sharp turns into a picture, and as a PDF page.
// Positions are in points from the top-left corner. Text uses Liberation Sans in pictures and
// Helvetica in PDFs; the two share the same letter widths, so both outputs line up.
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export const LETTER = { width: 612, height: 792 };
export const SAMPLE_MARK = "SAMPLE - made up";

let metrics;
async function fontMetrics() {
  if (!metrics) {
    const doc = await PDFDocument.create({ updateMetadata: false });
    metrics = {
      normal: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    };
  }
  return metrics;
}
export async function textWidth(text, size, bold = false) {
  const fonts = await fontMetrics();
  return (bold ? fonts.bold : fonts.normal).widthOfTextAtSize(text, size);
}

// A small seeded number source, so jittered "hand-written" text is the same every time.
export function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

// Builder for page items.
export function page(width = LETTER.width, height = LETTER.height) {
  const items = [];
  const api = {
    width,
    height,
    items,
    text(x, y, value, options = {}) {
      items.push({ type: "text", x, y, value: String(value), ...options });
      return api;
    },
    line(x1, y1, x2, y2, options = {}) {
      items.push({ type: "line", x1, y1, x2, y2, ...options });
      return api;
    },
    rect(x, y, w, h, options = {}) {
      items.push({ type: "rect", x, y, w, h, ...options });
      return api;
    },
  };
  return api;
}

const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

async function svgText(item) {
  const size = item.size ?? 10;
  const weight = item.bold ? "bold" : "normal";
  const style = item.italic ? "italic" : "normal";
  const fill = item.color ?? "#111111";
  const anchor = item.align === "right" ? "end" : item.align === "center" ? "middle" : "start";
  if (!item.hand)
    return `<text x="${item.x}" y="${item.y}" font-family="Liberation Sans" font-size="${size}" font-weight="${weight}" font-style="${style}" fill="${fill}" text-anchor="${anchor}">${escape(item.value)}</text>`;
  // Hand-written look: each letter is placed on its own with a small seeded wobble.
  const random = seeded(item.hand);
  const total = await textWidth(item.value, size);
  let x = item.align === "right" ? item.x - total : item.x;
  const parts = [];
  for (const letter of item.value) {
    const advance = await textWidth(letter, size);
    const dy = (random() - 0.5) * size * 0.18;
    const turn = (random() - 0.5) * 12;
    const grow = 1 + (random() - 0.5) * 0.14;
    if (letter.trim())
      parts.push(
        `<text x="0" y="0" font-family="Liberation Sans" font-size="${(size * grow).toFixed(2)}" font-style="italic" fill="${fill}" transform="translate(${x.toFixed(2)} ${(item.y + dy).toFixed(2)}) rotate(${turn.toFixed(2)}) skewX(-8)">${escape(letter)}</text>`,
      );
    x += advance * (1.04 + random() * 0.06);
  }
  return parts.join("");
}

export async function toSvg(sheet, scale = 2) {
  const body = [];
  for (const item of sheet.items) {
    if (item.type === "text") body.push(await svgText(item));
    else if (item.type === "line")
      body.push(
        `<line x1="${item.x1}" y1="${item.y1}" x2="${item.x2}" y2="${item.y2}" stroke="${item.color ?? "#444444"}" stroke-width="${item.width ?? 0.8}"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/>`,
      );
    else
      body.push(
        `<rect x="${item.x}" y="${item.y}" width="${item.w}" height="${item.h}" fill="${item.fill ?? "none"}"${item.stroke ? ` stroke="${item.stroke}" stroke-width="${item.strokeWidth ?? 0.8}"` : ""}${item.radius ? ` rx="${item.radius}"` : ""}/>`,
      );
  }
  const background = sheet.background ?? "#ffffff";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.width * scale}" height="${sheet.height * scale}" viewBox="0 0 ${sheet.width} ${sheet.height}"><rect width="${sheet.width}" height="${sheet.height}" fill="${background}"/>${body.join("")}</svg>`;
}

function colour(hex = "#111111") {
  const value = Number.parseInt(hex.slice(1), 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

// Writes the pages as one PDF. The file carries no dates or producer, so it is the same each time.
export async function toPdf(sheets, title) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(`${SAMPLE_MARK}: ${title}`);
  const fonts = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
  };
  for (const sheet of sheets) {
    const pdfPage = doc.addPage([sheet.width, sheet.height]);
    const flip = (y) => sheet.height - y;
    for (const item of sheet.items) {
      if (item.type === "text") {
        if (item.hand) throw new Error("Hand-written text is drawn in pictures only.");
        const font = item.bold
          ? item.italic
            ? fonts.boldItalic
            : fonts.bold
          : item.italic
            ? fonts.italic
            : fonts.normal;
        const size = item.size ?? 10;
        const width = font.widthOfTextAtSize(item.value, size);
        const x =
          item.align === "right" ? item.x - width : item.align === "center" ? item.x - width / 2 : item.x;
        pdfPage.drawText(item.value, { x, y: flip(item.y), size, font, color: colour(item.color) });
      } else if (item.type === "line") {
        pdfPage.drawLine({
          start: { x: item.x1, y: flip(item.y1) },
          end: { x: item.x2, y: flip(item.y2) },
          thickness: item.width ?? 0.8,
          color: colour(item.color ?? "#444444"),
          ...(item.dash ? { dashArray: item.dash.split(/[ ,]+/).map(Number) } : {}),
        });
      } else {
        pdfPage.drawRectangle({
          x: item.x,
          y: flip(item.y + item.h),
          width: item.w,
          height: item.h,
          ...(item.fill && item.fill !== "none" ? { color: colour(item.fill) } : {}),
          ...(item.stroke ? { borderColor: colour(item.stroke), borderWidth: item.strokeWidth ?? 0.8 } : {}),
          rotate: degrees(0),
        });
      }
    }
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
