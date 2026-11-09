import {
  lineText,
  ruleUrl,
  SITE,
  STATUS,
  type Lang,
  type LineFields,
} from "../../shared/telegram-words.ts";
import type { MonthWork } from "./month-work.ts";

const num = (value: number, lang: Lang) =>
  value.toLocaleString(lang === "es" ? "es-US" : "en-US", {
    maximumFractionDigits: 2,
  });
const money = (cents: number, lang: Lang) =>
  new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
const day = (date: string, lang: Lang) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(
    lang === "es" ? "es-US" : "en-US",
    { month: "long", day: "numeric", timeZone: "UTC" },
  );

/** The same month work as the web cards, as one Telegram message. */
export function monthWorkText(work: MonthWork, lang: Lang): string {
  const es = lang === "es";
  const page = `${SITE}${work.example ? "/example" : `/months/${work.month}`}`;
  const out: string[] = [es ? "Hice el papeleo de tu mes:" : "I did your month's paperwork:"];
  if (work.read.length) {
    const lines = work.read.reduce((sum, item) => sum + item.lines, 0);
    out.push(
      es
        ? `• Leí ${work.read.length} archivo(s) nuevo(s) y encontré ${lines} línea(s).`
        : `• Read ${work.read.length} new file(s) and found ${lines} line(s).`,
    );
  }
  if (work.unread)
    out.push(
      es
        ? `• Faltan leer ${work.unread} archivo(s).`
        : `• ${work.unread} more file(s) wait to be read.`,
    );
  if (work.waiting.length) {
    out.push(es ? "• Líneas que te esperan:" : "• Lines waiting for you:");
    for (const item of work.waiting) out.push(`   – ${lineText(item.fields as LineFields, lang)}`);
  }
  if (work.question?.key === "business-costs")
    out.push(
      es
        ? `• Una pregunta: ¿cuánto gastaste este mes en gasolina, teléfono y otros gastos para ${work.question.organization ?? "tu trabajo"}? Respóndela en ${page}`
        : `• One question: what did you spend this month on gas, your phone and other costs for ${work.question.organization ?? "your work"}? Answer it at ${page}`,
    );
  else if (work.question)
    out.push(
      es
        ? `• Falta un dato en una línea. Agrégalo en ${SITE}/review`
        : `• One fact is missing on a line. Add it at ${SITE}/review`,
    );
  if (work.plan) {
    out.push(
      es
        ? `• Plan: faltan ${num(work.plan.hoursNeeded, lang)} horas antes del ${day(work.monthEnd, lang)}.`
        : `• Plan: ${num(work.plan.hoursNeeded, lang)} hours still needed by ${day(work.monthEnd, lang)}.`,
    );
    for (const step of work.plan.steps)
      out.push(
        `   – ${num(step.hours, lang)} h ${es ? "en" : "at"} ${step.organization}` +
          (step.shifts && step.shiftHours
            ? es
              ? ` (más o menos ${step.shifts} turno(s) de ${num(step.shiftHours, lang)} h)`
              : ` (about ${step.shifts} shift(s) of ${num(step.shiftHours, lang)} h)`
            : ""),
      );
    if (work.plan.payNeededCents)
      out.push(
        es
          ? `   – o ${money(work.plan.payNeededCents, lang)} más de pago`
          : `   – or ${money(work.plan.payNeededCents, lang)} more pay`,
      );
  }
  if (work.packet) {
    const shown = new Date(`${work.packet}-15T12:00:00Z`).toLocaleDateString(
      es ? "es-US" : "en-US",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
    out.push(
      es
        ? `• Tu paquete de prueba de ${shown} está listo. Envía /packet y te mando el PDF.`
        : `• Your proof packet for ${shown} is ready. Send /packet and I'll send you the PDF.`,
    );
  }
  const status = STATUS[lang][work.now.status] ?? work.now.status;
  out.push(
    "",
    work.now.hours === null
      ? `${es ? "Este mes" : "This month"}: ${status}.`
      : es
        ? `Este mes: ${status}. ${num(work.now.hours, lang)} de ${work.targetHours} horas confirmadas.`
        : `This month: ${status}. ${num(work.now.hours, lang)} of ${work.targetHours} hours confirmed.`,
  );
  if (work.waiting.length)
    out.push(
      es
        ? `Solo tú confirmas cada línea: ${SITE}/review`
        : `Only you confirm each line: ${SITE}/review`,
    );
  out.push(
    `${es ? "Regla" : "Rule"}: ${work.now.citation} — ${ruleUrl(work.now.citation)}`,
    es ? "Tu estado decide." : "Your state decides.",
  );
  return out.join("\n");
}
