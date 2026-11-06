import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

import { MARIA, exampleDates } from "./example-people.ts";

const money = (cents: number) =>
  `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
const day = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

// The text of Maria's made-up earnings summary for the month of `asOf`.
// It shows what the app paid. Her own costs are not on it.
export function exampleSampleLines(asOf: string) {
  const d = exampleDates(asOf);
  const s = MARIA.sample;
  return {
    mark: "SAMPLE - made up",
    markEs: "MUESTRA - inventado",
    company: MARIA.delivery,
    title: "Earnings summary",
    rows: [
      ["Driver", "Maria (made up)"],
      ["Period", `${day(d.start)} to ${day(d.today)}`],
      ["Paid on", day(d.today)],
      ["Deliveries completed", String(s.deliveries)],
      ["Delivery pay", money(s.deliveryPayCents)],
      ["Customer tips", money(s.tipsCents)],
      ["Total earnings", money(s.totalCents)],
    ] as [string, string][],
    notes: [
      "Your own costs, such as gas and your phone, are not shown here.",
      "This is not a real document. It was made for the Eighty example.",
    ],
  };
}

export async function exampleSamplePdf(asOf: string): Promise<Uint8Array> {
  const text = exampleSampleLines(asOf);
  const pdf = await PDFDocument.create({ updateMetadata: false });
  // Fixed metadata keeps the file identical for the same day, so a second tap
  // finds the same saved file instead of storing a copy.
  const stamp = new Date(`${asOf}T12:00:00Z`);
  pdf.setTitle(`${text.title} - ${text.mark}`);
  pdf.setCreationDate(stamp);
  pdf.setModificationDate(stamp);
  pdf.setProducer("Eighty example");
  pdf.setCreator("Eighty example");
  const page = pdf.addPage([612, 792]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.23, 0.21);
  const red = rgb(0.67, 0.33, 0.18);
  page.drawText(text.mark, {
    x: 120,
    y: 260,
    size: 54,
    font: bold,
    color: red,
    opacity: 0.18,
    rotate: degrees(35),
  });
  page.drawRectangle({
    x: 48,
    y: 712,
    width: 516,
    height: 44,
    color: red,
  });
  page.drawText(`${text.mark}  /  ${text.markEs}`, {
    x: 62,
    y: 728,
    size: 18,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(text.company, {
    x: 62,
    y: 668,
    size: 20,
    font: bold,
    color: ink,
  });
  page.drawText(text.title, {
    x: 62,
    y: 640,
    size: 16,
    font: regular,
    color: ink,
  });
  let y = 596;
  for (const [label, value] of text.rows) {
    const strong = label === "Total earnings";
    page.drawText(label, {
      x: 62,
      y,
      size: 14,
      font: strong ? bold : regular,
      color: ink,
    });
    const font = strong ? bold : regular;
    page.drawText(value, {
      x: 550 - font.widthOfTextAtSize(value, 14),
      y,
      size: 14,
      font,
      color: ink,
    });
    page.drawLine({
      start: { x: 62, y: y - 10 },
      end: { x: 550, y: y - 10 },
      thickness: 0.5,
      color: rgb(0.8, 0.85, 0.82),
    });
    y -= 34;
  }
  y -= 10;
  for (const note of text.notes) {
    page.drawText(note, { x: 62, y, size: 11, font: regular, color: ink });
    y -= 18;
  }
  return pdf.save({ useObjectStreams: false });
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The picture version. It needs a font on the machine that runs it, so it is
// made by scripts/make-example-sample.ts, not by the server.
export function exampleSampleSvg(asOf: string): string {
  const text = exampleSampleLines(asOf);
  const rows = text.rows
    .map(([label, value], index) => {
      const y = 330 + index * 68;
      const weight = label === "Total earnings" ? 700 : 400;
      return `<text x="80" y="${y}" font-weight="${weight}">${escape(label)}</text><text x="1120" y="${y}" text-anchor="end" font-weight="${weight}">${escape(value)}</text><line x1="80" x2="1120" y1="${y + 22}" y2="${y + 22}" stroke="#ccd9d1" stroke-width="2"/>`;
    })
    .join("");
  const notes = text.notes
    .map(
      (note, index) =>
        `<text x="80" y="${860 + index * 40}" font-size="24">${escape(note)}</text>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1000" viewBox="0 0 1200 1000">
<rect width="1200" height="1000" fill="#ffffff"/>
<g font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" fill="#173b35" font-size="30">
<rect x="40" y="40" width="1120" height="90" fill="#ab542e"/>
<text x="80" y="100" font-size="38" font-weight="700" fill="#ffffff">${escape(text.mark)}  /  ${escape(text.markEs)}</text>
<text x="80" y="200" font-size="44" font-weight="700">${escape(text.company)}</text>
<text x="80" y="250" font-size="32">${escape(text.title)}</text>
${rows}
${notes}
<text x="600" y="640" font-size="110" font-weight="700" fill="#ab542e" fill-opacity="0.16" text-anchor="middle" transform="rotate(-30 600 640)">${escape(text.mark)}</text>
</g>
</svg>`;
}
