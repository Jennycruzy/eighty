import type { ActionRunContext } from "@agent-native/core/action";
import { readPrivateBlob } from "@agent-native/core/private-blob";
import { createError } from "h3";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { z } from "zod";

import {
  lineText,
  ruleUrl,
  STATUS,
  type Lang,
  type LineFields,
} from "../../shared/telegram-words.ts";
import { REQUIRED_HOURS, REQUIRED_INCOME_CENTS } from "../rules/constants.ts";
import { shiftMonth, validMonth } from "../rules/dates.ts";
import { inspectDocument } from "./document-content.ts";
import { ownDocumentRow } from "./document-records.ts";
import { requireExampleAccount, today } from "./example-accounts.ts";
import { isExampleEmail } from "./example-identity.ts";
import { EXAMPLE_PROFILES } from "./example-people.ts";
import { listEvidenceRecords } from "./evidence-records.ts";
import { ownMemberActor } from "./member-identity.ts";
import { memberMonthFacts, memberMonthResult } from "./member-month.ts";
import { getMemberRecord } from "./member-records.ts";
import type { MonthFacts, SavedLine } from "./month-input.ts";

export const packetInput = z.strictObject({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  language: z.enum(["en", "es"]).optional(),
});

/** A month a packet can be made for: the rule is met, excluded or deemed met. */
export const PACKET_DONE = new Set(["Meets", "Exempt", "Deemed"]);
const MAX_PACKET_BYTES = 25 * 1024 * 1024;

type Row = SavedLine & { documentId: string | null };

/** The signed-in member's month, from the same code their month page uses. */
async function packetSource(
  context: ActionRunContext | undefined,
  month: string,
) {
  const actor = await ownMemberActor(context);
  const member = await getMemberRecord(actor);
  const example = isExampleEmail(actor.email);
  const person = example ? (await requireExampleAccount(context)).person : null;
  const facts: MonthFacts = person
    ? (EXAMPLE_PROFILES[person].facts as MonthFacts)
    : memberMonthFacts(member.screener);
  const rows = (await listEvidenceRecords(context)) as unknown as Row[];
  const asOf = today();
  const result = memberMonthResult(facts, rows, month, asOf);
  return { actor, member, person, rows, result, asOf };
}

/** The latest month, this one or the one before, that a packet can be made for. */
export async function packetMonth(
  context: ActionRunContext | undefined,
): Promise<string | null> {
  const current = today().slice(0, 7);
  for (const month of [current, shiftMonth(current, -1)]) {
    const { result } = await packetSource(context, month);
    if (PACKET_DONE.has(result.status)) return month;
  }
  return null;
}

const monthName = (month: string, lang: Lang) =>
  new Date(`${month}-15T12:00:00Z`).toLocaleDateString(
    lang === "es" ? "es-US" : "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );
const money = (cents: number, lang: Lang) =>
  new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
const num = (value: number, lang: Lang) =>
  value.toLocaleString(lang === "es" ? "es-US" : "en-US", {
    maximumFractionDigits: 2,
  });

const WORDS = {
  en: {
    title: "Proof for the Medicaid work rule",
    month: "Month",
    name: "Name",
    example: (who: string) => `${who} (an example person, made up)`,
    caseNumber: "Case number",
    state: "State",
    result: "Result",
    hours: (h: string) => `${h} of ${REQUIRED_HOURS} hours`,
    pay: (amount: string) => `${amount} of ${money(REQUIRED_INCOME_CENTS, "en")} pay`,
    why: "Why",
    byHours: `${REQUIRED_HOURS} or more hours this month of work, volunteer service, school or a work program.`,
    byPay: `Pay this month of at least ${REQUIRED_HOURS} hours at the federal minimum wage (${money(REQUIRED_INCOME_CENTS, "en")}).`,
    rule: "Rule",
    lines: "What this month counted",
    fromFile: (n: number) => `document ${n}, attached`,
    typed: "typed by me",
    afterCosts: (amount: string) => `${amount} after costs`,
    noLines: "Nothing to attach: this result comes from the answers in my account.",
    attached: (n: number) => (n === 1 ? "1 document is attached after this page." : `${n} documents are attached after this page.`),
    sign: "I confirm that this is true.",
    signature: "Signature",
    date: "Date",
    federal: "These are the federal rules only. The state makes the decision.",
    footer: "Made with Eighty, tryeighty.space. Eighty is not the state.",
    doc: (n: number, of: number) => `Document ${n} of ${of}`,
    file: "eighty-proof",
    subject: (month: string) => `Medicaid work rule proof for ${month}`,
    body: (p: { month: string; status: string; amount: string; docs: number; citation: string; caseNumber: string | null }) =>
      [
        "Hello,",
        "",
        `Attached is my proof for the Medicaid work rule for ${p.month}: ${p.status}${p.amount ? `, ${p.amount}` : ""}.`,
        `It has a cover page with the rule it meets (${p.citation})${p.docs ? ` and ${p.docs === 1 ? "1 document" : `${p.docs} documents`}` : ""}.`,
        ...(p.caseNumber ? ["", `Case number: ${p.caseNumber}`] : []),
        "",
        "Thank you,",
        "",
      ].join("\n"),
  },
  es: {
    title: "Prueba para la regla de trabajo de Medicaid",
    month: "Mes",
    name: "Nombre",
    example: (who: string) => `${who} (una persona de ejemplo, inventada)`,
    caseNumber: "Número de caso",
    state: "Estado",
    result: "Resultado",
    hours: (h: string) => `${h} de ${REQUIRED_HOURS} horas`,
    pay: (amount: string) => `${amount} de ${money(REQUIRED_INCOME_CENTS, "es")} de pago`,
    why: "Por qué",
    byHours: `${REQUIRED_HOURS} horas o más este mes de trabajo, voluntariado, estudios o un programa de trabajo.`,
    byPay: `Pago este mes de al menos ${REQUIRED_HOURS} horas al salario mínimo federal (${money(REQUIRED_INCOME_CENTS, "es")}).`,
    rule: "Regla",
    lines: "Lo que contó este mes",
    fromFile: (n: number) => `documento ${n}, adjunto`,
    typed: "escrito por mí",
    afterCosts: (amount: string) => `${amount} después de gastos`,
    noLines: "No hay nada que adjuntar: este resultado viene de las respuestas en mi cuenta.",
    attached: (n: number) => (n === 1 ? "Después de esta página va 1 documento." : `Después de esta página van ${n} documentos.`),
    sign: "Confirmo que esto es verdad.",
    signature: "Firma",
    date: "Fecha",
    federal: "Estas son solo las reglas federales. El estado toma la decisión.",
    footer: "Hecho con Eighty, tryeighty.space. Eighty no es el estado.",
    doc: (n: number, of: number) => `Documento ${n} de ${of}`,
    file: "eighty-prueba",
    subject: (month: string) => `Prueba para la regla de trabajo de Medicaid de ${month}`,
    body: (p: { month: string; status: string; amount: string; docs: number; citation: string; caseNumber: string | null }) =>
      [
        "Hola:",
        "",
        `Adjunto mi prueba para la regla de trabajo de Medicaid de ${p.month}: ${p.status}${p.amount ? `, ${p.amount}` : ""}.`,
        `Tiene una portada con la regla que cumple (${p.citation})${p.docs ? ` y ${p.docs === 1 ? "1 documento" : `${p.docs} documentos`}` : ""}.`,
        ...(p.caseNumber ? ["", `Número de caso: ${p.caseNumber}`] : []),
        "",
        "Gracias,",
        "",
      ].join("\n"),
  },
} as const;

/** Standard PDF fonts cannot draw every character; swap the few we use. */
const safe = (text: string) =>
  text
    .replace(/→/g, "-")
    .replace(/[   ]/g, " ")
    .replace(/[^\x20-\x7E¡-ÿ–—‘’“”•·]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const out: string[] = [];
  for (const paragraph of safe(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export interface PacketFile {
  filename: string;
  pdf: Uint8Array;
  pages: number;
  documents: number;
  email: { subject: string; body: string };
  month: string;
  status: string;
}

/**
 * The member's proof packet for one finished month: a cover page in plain
 * words with the rule and its citation, a signature line, then every document
 * behind a counted line. It is made from the member's own confirmed lines only.
 */
export async function buildProofPacket(
  input: z.infer<typeof packetInput>,
  context: ActionRunContext | undefined,
): Promise<PacketFile> {
  const { month, language } = packetInput.parse(input);
  if (!validMonth(month) || `${month}-01` > today())
    throw createError({ statusCode: 422, statusMessage: "Choose a past or current month" });
  const { actor, member, person, rows, result } = await packetSource(context, month);
  if (!PACKET_DONE.has(result.status))
    throw createError({
      statusCode: 409,
      statusMessage: "The packet is ready once your confirmed proof meets the rule for that month",
    });
  const lang: Lang = language ?? (member.language === "es-US" ? "es" : "en");
  const w = WORDS[lang];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byHours = result.status === "Meets" && (result.hours ?? 0) >= REQUIRED_HOURS;
  const byPay =
    result.status === "Meets" &&
    !byHours &&
    (result.amountCents ?? 0) >= REQUIRED_INCOME_CENTS;
  const counted = result.lines
    .map((line) => byId.get(line.id))
    .filter((row): row is Row => Boolean(row) && row!.status === "confirmed")
    // Only the lines behind the measure that met the rule.
    .filter((row) =>
      byPay ? row.fields.kind === "income" : byHours ? row.fields.kind !== "income" : true,
    );

  // Each document once, in the order its first line appears.
  const documentIds: string[] = [];
  for (const row of counted)
    if (row.documentId && !documentIds.includes(row.documentId))
      documentIds.push(row.documentId);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`${w.title} · ${monthName(month, lang)}`);
  pdf.setProducer("Eighty");
  pdf.setCreator("Eighty");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.07, 0.08);
  const grey = rgb(0.38, 0.38, 0.4);
  const rule = rgb(0.82, 0.82, 0.84);

  const W = 612, H = 792, M = 56, width = W - 2 * M;
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;
  const ensure = (needed: number) => {
    if (y - needed < M + 40) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
  };
  const text = (value: string, opts: { size?: number; font?: PDFFont; color?: typeof ink; indent?: number; gap?: number } = {}) => {
    const size = opts.size ?? 11, font = opts.font ?? regular, indent = opts.indent ?? 0;
    for (const line of wrap(value, font, size, width - indent)) {
      ensure(size + 4);
      page.drawText(line, { x: M + indent, y: y - size, size, font, color: opts.color ?? ink });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };
  const field = (label: string, value: string) => {
    ensure(18);
    page.drawText(safe(label), { x: M, y: y - 11, size: 10, font: bold, color: grey });
    const lines = wrap(value, regular, 11, width - 120);
    lines.forEach((line, index) =>
      page.drawText(line, { x: M + 120, y: y - 11 - index * 15, size: 11, font: regular, color: ink }),
    );
    y -= Math.max(1, lines.length) * 15 + 4;
  };
  const divider = () => {
    ensure(16);
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: rule });
    y -= 12;
  };

  text(w.title, { size: 20, font: bold, gap: 4 });
  text(monthName(month, lang), { size: 14, color: grey, gap: 10 });
  divider();
  field(w.name, person ? w.example(EXAMPLE_PROFILES[person].name) : "____________________________");
  if (member.caseNumber) field(w.caseNumber, member.caseNumber);
  if (member.stateCode) field(w.state, member.stateCode);
  field(w.month, monthName(month, lang));
  divider();

  const status = STATUS[lang][result.status] ?? result.status;
  const amounts: string[] = [];
  if (byHours) amounts.push(w.hours(num(result.hours!, lang)));
  if (byPay) amounts.push(w.pay(money(result.amountCents!, lang)));
  field(w.result, [status, ...amounts].join(" · "));
  const plain = result as { explanation?: string; explanationEs?: string };
  const explained = lang === "es" ? plain.explanationEs : plain.explanation;
  const why =
    explained ??
    (result.status === "Meets"
      ? byHours
        ? w.byHours
        : w.byPay
      : result.basis);
  field(w.why, why);
  field(w.rule, `${result.citation} · ${ruleUrl(result.citation)}`);
  divider();

  text(w.lines, { size: 12, font: bold, gap: 4 });
  if (!counted.length) text(w.noLines, { color: grey });
  for (const row of counted) {
    const from = row.documentId
      ? w.fromFile(documentIds.indexOf(row.documentId) + 1)
      : w.typed;
    const net = row.fields.income?.costsConfirmed
      ? row.fields.income.netEarningsCents
      : undefined;
    const after = typeof net === "number" ? `, ${w.afterCosts(money(net, lang))}` : "";
    text(`•  ${lineText(row.fields as LineFields, lang)}${after} (${from})`, { indent: 4 });
  }
  if (documentIds.length) {
    y -= 4;
    text(w.attached(documentIds.length), { color: grey });
  }
  divider();

  text(w.sign, { gap: 22 });
  ensure(30);
  page.drawLine({ start: { x: M, y }, end: { x: M + 300, y }, thickness: 0.75, color: ink });
  page.drawLine({ start: { x: M + 340, y }, end: { x: W - M, y }, thickness: 0.75, color: ink });
  y -= 13;
  page.drawText(safe(w.signature), { x: M, y, size: 9, font: regular, color: grey });
  page.drawText(safe(w.date), { x: M + 340, y, size: 9, font: regular, color: grey });
  y -= 24;
  text(w.federal, { size: 9, color: grey });

  for (const cover of pdf.getPages())
    cover.drawText(safe(w.footer), { x: M, y: 30, size: 8, font: regular, color: grey });

  // The documents behind the counted lines, each marked with its number.
  for (const [index, documentId] of documentIds.entries()) {
    const row = await ownDocumentRow(documentId, actor, member);
    const original = Buffer.from((await readPrivateBlob(row.handle)).data);
    const label = safe(`${w.doc(index + 1, documentIds.length)} · ${monthName(month, lang)}`);
    if (original.subarray(0, 5).toString() === "%PDF-") {
      const source = await PDFDocument.load(original, { updateMetadata: false });
      const copied = await pdf.copyPages(source, source.getPageIndices());
      for (const added of copied) {
        pdf.addPage(added);
        const { height } = added.getSize();
        added.drawText(label, { x: 18, y: height - 14, size: 8, font: regular, color: grey });
      }
    } else {
      const inspected = await inspectDocument(original, row.rotation);
      const image = await pdf.embedJpg(Buffer.from(inspected.preview!, "base64"));
      const sheet = pdf.addPage([W, H]);
      sheet.drawText(label, { x: M, y: H - 36, size: 9, font: regular, color: grey });
      const fit = image.scaleToFit(W - 2 * M, H - 2 * M - 24);
      sheet.drawImage(image, {
        x: (W - fit.width) / 2,
        y: (H - 24 - fit.height) / 2,
        width: fit.width,
        height: fit.height,
      });
    }
  }

  const bytes = await pdf.save();
  if (bytes.length > MAX_PACKET_BYTES)
    throw createError({ statusCode: 413, statusMessage: "The packet is too large to make here" });
  const shown = monthName(month, lang);
  return {
    filename: `${w.file}-${month}.pdf`,
    pdf: bytes,
    pages: pdf.getPageCount(),
    documents: documentIds.length,
    month,
    status: result.status,
    email: {
      subject: w.subject(shown) + (member.caseNumber ? ` · ${member.caseNumber}` : ""),
      body: w.body({
        month: shown,
        status,
        amount: amounts.join(", "),
        docs: documentIds.length,
        citation: result.citation,
        caseNumber: member.caseNumber,
      }),
    },
  };
}

/** The packet for the browser: the PDF as base64 and the email draft. */
export async function proofPacket(
  input: z.infer<typeof packetInput>,
  context: ActionRunContext | undefined,
) {
  const packet = await buildProofPacket(input, context);
  return {
    filename: packet.filename,
    data: Buffer.from(packet.pdf).toString("base64"),
    pages: packet.pages,
    documents: packet.documents,
    month: packet.month,
    status: packet.status,
    email: packet.email,
  };
}
