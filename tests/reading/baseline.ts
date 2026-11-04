// The baseline: plain text matching, no model. It gives the reader's numbers something to beat.
// PDFs: text pulled with pdfjs-dist, then simple patterns for dates, money and hours next to common labels.
// Pictures: this baseline cannot read them, so it answers nothing (no proposals).
// The patterns were written by looking at practice documents only.
import type { ReaderResult } from "../../shared/evidence.ts";
import { pdfText } from "./pdf-text.ts";

type Proposal = ReaderResult["proposals"][number];
type Fields = Proposal["fields"];

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
  ene: 1, enero: 1, febrero: 2, marzo: 3, abr: 4, abril: 4, mayo: 5, junio: 6, julio: 7, ago: 8, agosto: 8,
  septiembre: 9, octubre: 10, noviembre: 11, dic: 12, diciembre: 12,
};
const iso = (year: number, month: number, day: number) =>
  month >= 1 && month <= 12 && day >= 1 && day <= 31
    ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;

const DATE = new RegExp(
  [
    String.raw`(\d{1,2})/(\d{1,2})/(\d{4})`,
    String.raw`([A-Za-z]{3,9})\.? (\d{1,2}), (\d{4})`,
    String.raw`(\d{1,2}) (?:de )?([a-záéíóú]{3,10})\.? (?:de )?(\d{4})`,
  ].join("|"),
  "gi",
);

// Every date on a line, in order, as YYYY-MM-DD.
export function datesIn(text: string, dayFirst = false): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(DATE)) {
    let value: string | null = null;
    if (match[1]) {
      const [a, b] = [Number(match[1]), Number(match[2])];
      value = dayFirst ? iso(Number(match[3]), b, a) : iso(Number(match[3]), a, b);
    } else if (match[4]) {
      const month = MONTHS[match[4].toLowerCase()];
      value = month ? iso(Number(match[6]), month, Number(match[5])) : null;
    } else if (match[8]) {
      const month = MONTHS[match[8].toLowerCase()];
      value = month ? iso(Number(match[9]), month, Number(match[7])) : null;
    }
    if (value) found.push(value);
  }
  return found;
}

const NUMBER = /-?\$?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\$?\d+(?:\.\d+)?/g;
// Every number on a line, with dates and ID-like codes left out.
export function numbersIn(text: string): number[] {
  const clean = text.replace(DATE, " ").replace(/[A-Z]{1,4}-\d+/g, " ").replace(/\(\d+\)/g, " ");
  return [...clean.matchAll(NUMBER)].map((match) => Number(match[0].replace(/[$,]/g, "")));
}
const cents = (value: number | undefined) => (value === undefined || !Number.isFinite(value) ? undefined : Math.round(value * 100));
const cells = (line: string) => line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean);

// Numbers on the line that starts with the label.
function rowNumbers(lines: string[], label: RegExp): number[] | null {
  const line = lines.find((item) => label.test(cells(item)[0] ?? ""));
  return line ? numbersIn(line.replace(label, " ")) : null;
}
// A label in a header row whose value sits in the same column of the next line.
function columnValue(lines: string[], label: RegExp): string | null {
  for (let index = 0; index < lines.length - 1; index++) {
    const head = cells(lines[index] ?? "");
    const column = head.findIndex((cell) => label.test(cell));
    if (column === -1) continue;
    let below = cells(lines[index + 1] ?? "");
    if (below.length === head.length + 1 && !numbersIn(below[0] ?? "").length) below = below.slice(1);
    if (below.length === head.length) return below[column] ?? null;
  }
  return null;
}
const firstLine = (lines: string[]) => cells(lines.find((line) => !/SAMPLE - made up/.test(line)) ?? "")[0] ?? null;

function payStub(lines: string[]): Fields {
  const text = lines.join("\n");
  const fields: Fields = { kind: "income", income: { kind: "wages" } };
  const range = lines.map((line) => line.match(/(.+?)\s+-\s+(.+)/)).find((match) => match && datesIn(match[0]).length === 2);
  const header = columnValue(lines, /PERIOD BEGINNING|INICIO DEL PERIODO/i);
  if (range) [fields.start, fields.end] = datesIn(range[0]);
  else if (header) {
    const line = lines[lines.findIndex((item) => /PERIOD BEGINNING|INICIO DEL PERIODO/i.test(item)) + 1];
    [fields.start, fields.end] = datesIn(line ?? "");
  }
  const paid = text.match(/(?:pay date|fecha de pago):?\s*([^\n]+)/i);
  const check = columnValue(lines, /CHECK DATE|FECHA DEL CHEQUE/i);
  const receivedOn = paid ? datesIn(paid[1] ?? "")[0] : check ? datesIn(check)[0] : undefined;
  const grossRow = rowNumbers(lines, /^(gross pay|pago bruto)$/i);
  let gross: number | undefined;
  if (grossRow?.length === 3) {
    fields.hours = grossRow[0];
    gross = grossRow[1];
  } else if (grossRow?.length) gross = grossRow[0];
  else gross = numbersIn(columnValue(lines, /^(gross pay|pago bruto|GROSS|BRUTO)$/i) ?? "")[0];
  const pretaxRow = rowNumbers(lines, /^(total pre-tax deductions|total deducciones antes de impuestos)$/i);
  const pretax = pretaxRow?.length ? pretaxRow[0] : numbersIn(columnValue(lines, /^(PRE-TAX|ANTES DE IMPUESTOS)$/i) ?? "")[0];
  const net = numbersIn(columnValue(lines, /^(net pay|pago neto|NET|NETO)\b/i) ?? "")[0];
  fields.organization = firstLine(lines);
  fields.income = {
    kind: "wages",
    ...(receivedOn ? { receivedOn } : {}),
    ...(cents(gross) !== undefined ? { grossPayCents: cents(gross) } : {}),
    ...(cents(pretax) !== undefined ? { preTaxDeductionsCents: cents(pretax) } : {}),
    ...(cents(net) !== undefined ? { netEarningsCents: cents(net) } : {}),
  };
  return fields;
}

function gigSummary(lines: string[]): Fields {
  const value = (label: RegExp) => {
    const line = lines.find((item) => label.test(item));
    return line ? line.replace(label, " ") : null;
  };
  const range = lines.map((line) => datesIn(line)).find((dates) => dates.length === 2);
  const gross = numbersIn(value(/gross earnings|ganancias brutas/i) ?? "")[0];
  const net = numbersIn(value(/net payout|pago neto/i) ?? "")[0];
  const hours = numbersIn(value(/hours driving|active hours|horas activas|horas manejando/i) ?? "")[0];
  const paid = datesIn(value(/paid to your bank on|depositado en su banco el/i) ?? "")[0];
  return {
    kind: "income",
    ...(range ? { start: range[0], end: range[1] } : {}),
    ...(hours !== undefined ? { hours } : {}),
    organization: firstLine(lines),
    income: {
      kind: "self-employment",
      ...(paid ? { receivedOn: paid } : {}),
      ...(cents(gross) !== undefined ? { grossPayCents: cents(gross) } : {}),
      ...(cents(net) !== undefined ? { netEarningsCents: cents(net) } : {}),
    },
  };
}

function signInSheet(lines: string[], spanish: boolean): Fields[] {
  const organization = firstLine(lines);
  const contact = lines.join("\n").match(/(?:volunteer coordinator|coordinadora de voluntarios):\s*([^\n]+)/i)?.[1]?.trim();
  return lines
    .map(cells)
    .filter((row) => row.length >= 5 && datesIn(row[0] ?? "", spanish).length === 1)
    .map((row) => {
      const date = datesIn(row[0] ?? "", spanish)[0];
      return {
        kind: "service" as const,
        start: date,
        end: date,
        hours: numbersIn(row[4] ?? "")[0],
        organization,
        ...(contact ? { service: { confirmationContact: contact } } : {}),
      };
    });
}

function enrollmentLetter(lines: string[]): Fields {
  const text = lines.join(" ");
  const dates = datesIn(text);
  const credits = text.match(/(\d+) (?:credit hours|horas de crédito)/i);
  const enrollment = /less than half-time|menos de medio tiempo/i.test(text)
    ? ("less-than-half" as const)
    : /half-time|medio tiempo/i.test(text)
      ? ("half-time" as const)
      : /full-time|tiempo completo/i.test(text)
        ? ("full-time" as const)
        : null;
  return {
    kind: "education",
    organization: firstLine(lines),
    education: {
      ...(enrollment ? { enrollment } : {}),
      ...(/credit-bearing|con créditos/i.test(text) ? { qualifyingProgram: true } : {}),
      ...(dates.length >= 3 ? { termStart: dates[1], termEnd: dates[2] } : {}),
      ...(credits ? { credits: Number(credits[1]), usesCreditHours: true } : {}),
    },
  };
}

function classSchedule(lines: string[]): Fields {
  const text = lines.join("\n");
  const term = lines.find((line) => /classes begin|inicio de clases/i.test(line));
  const dates = term ? datesIn(term) : [];
  const credits = text.match(/(?:total credits|total de créditos):\s*(\d+(?:\.\d+)?)/i);
  return {
    kind: "education",
    organization: firstLine(lines),
    education: {
      ...(dates.length === 2 ? { termStart: dates[0], termEnd: dates[1] } : {}),
      ...(credits ? { credits: Number(credits[1]) } : {}),
    },
  };
}

// Reads text and fills in what simple patterns can find.
export function readText(text: string): ReaderResult {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const usDocument = !/£|National Insurance|\bPAYE\b|\bMXN\b|\bRFC\b|\bIMSS\b/.test(text);
  const proposal = (fields: Fields, questions: Proposal["questions"] = []): Proposal => ({ fields, confidence: 0.5, questions });
  let proposals: Proposal[] = [];
  if (!usDocument) proposals = [];
  else if (/pay period|periodo de pago|period beginning|inicio del periodo/i.test(text)) proposals = [proposal(payStub(lines))];
  else if (/sign-in sheet|registro de voluntarios/i.test(text))
    proposals = signInSheet(lines, /registro de voluntarios/i.test(text)).map((fields) => proposal(fields));
  else if (/(fees|comisiones)/i.test(text) && /(payout|pago neto)/i.test(text)) proposals = [proposal(gigSummary(lines))];
  else if (/class schedule|horario de clases/i.test(text)) proposals = [proposal(classSchedule(lines), ["school-status"])];
  else if (/(credit hours|horas de crédito)/i.test(text) && /(enrolled|inscrit)/i.test(text))
    proposals = [proposal(enrollmentLetter(lines))];
  return { usDocument, proposals };
}

export async function readByText(input: { bytes: Uint8Array; mime: string }): Promise<ReaderResult> {
  if (input.mime !== "application/pdf") return { usDocument: true, proposals: [] };
  return readText((await pdfText(input.bytes)).join("\n"));
}
