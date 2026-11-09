import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";

import { lineText, ruleUrl, STATUS, type LineFields } from "../../shared/telegram-words";
import type { EvidenceFields } from "../../shared/evidence";
import { useLanguage, languageLink } from "../lib/language";

export interface MonthWorkResult {
  widget: "eighty.month-work";
  example: boolean;
  month: string;
  asOf: string;
  monthEnd: string;
  targetHours: number;
  targetCents: number;
  now: MonthState;
  ifConfirmed: MonthState | null;
  read: { documentId: string; outcome: string; lines: number }[];
  unread: number;
  waiting: {
    id: string;
    version: number;
    fields: EvidenceFields;
    fromDocument: boolean;
    questions: string[];
  }[];
  question:
    | {
        key: string;
        lineId: string;
        version: number;
        organization?: string | null;
        grossPayCents?: number;
      }
    | null;
  plan: {
    hoursNeeded: number;
    payNeededCents: number | null;
    steps: {
      kind: string;
      organization: string;
      hours: number;
      shiftHours: number | null;
      shifts: number | null;
    }[];
  } | null;
  done: boolean;
}
interface MonthState {
  status: string;
  citation: string;
  hours: number | null;
  amountCents: number | null;
  missing: string[];
}

const COPY = {
  en: {
    button: "Do my month",
    working: "Working on your month…",
    again: "Check again",
    title: "Your month, done for you to check",
    status: "This month",
    hours: (h: string, t: number) => `${h} of ${t} hours confirmed`,
    ifConfirmed: (h: string) => `${h} hours once you confirm the lines below`,
    read: (files: number, lines: number) =>
      `I read ${files === 1 ? "1 new file" : `${files} new files`} and found ${lines === 1 ? "1 line" : `${lines} lines`}.`,
    unread: (n: number) =>
      n === 1 ? "1 more file is waiting to be read." : `${n} more files are waiting to be read.`,
    budget: "Reading is resting for today; your files are saved.",
    waiting: "Lines waiting for you",
    fromFile: "From your file",
    fromWords: "From what you told me",
    confirm: "Confirm",
    edit: "Edit",
    reject: "Not right",
    review: "Check this one on the review page",
    question: "One question",
    costs: (org: string) =>
      `What did you spend this month on gas, your phone and other costs for ${org}? A gig app's pay summary does not show them, and the rule counts pay after costs.`,
    costsLabel: "Costs this month, in dollars",
    after: (amount: string) => `Pay after costs: ${amount}`,
    save: "Save answer",
    missing: "One fact is missing on a line. Add it on the review page.",
    plan: "Plan to close the month",
    needed: (h: string, by: string) => `${h} hours still needed by ${by}.`,
    step: (h: string, org: string) => `${h} hours at ${org}`,
    shifts: (n: number, h: string) =>
      n === 1 ? `about 1 shift of ${h} hours` : `about ${n} shifts of ${h} hours`,
    orPay: (amount: string) => `Or ${amount} more pay this month.`,
    checked: "Checked with the rules: each step alone would meet the rule.",
    noSteps: "Add work, school or volunteer hours, or pay, on the add page.",
    done: "Your confirmed proof meets the rule this month.",
    rule: "Rule",
    footer: "Only you can confirm a line. Your state decides.",
    error: "That didn't work. Try again.",
  },
  es: {
    button: "Haz mi mes",
    working: "Trabajando en tu mes…",
    again: "Revisar otra vez",
    title: "Tu mes, listo para que lo revises",
    status: "Este mes",
    hours: (h: string, t: number) => `${h} de ${t} horas confirmadas`,
    ifConfirmed: (h: string) => `${h} horas cuando confirmes las líneas de abajo`,
    read: (files: number, lines: number) =>
      `Leí ${files === 1 ? "1 archivo nuevo" : `${files} archivos nuevos`} y encontré ${lines === 1 ? "1 línea" : `${lines} líneas`}.`,
    unread: (n: number) =>
      n === 1 ? "Falta leer 1 archivo más." : `Faltan leer ${n} archivos más.`,
    budget: "La lectura descansa por hoy; tus archivos están guardados.",
    waiting: "Líneas que te esperan",
    fromFile: "De tu archivo",
    fromWords: "De lo que me dijiste",
    confirm: "Confirmar",
    edit: "Editar",
    reject: "No es correcto",
    review: "Revisa esta en la página de revisión",
    question: "Una pregunta",
    costs: (org: string) =>
      `¿Cuánto gastaste este mes en gasolina, teléfono y otros gastos para ${org}? El resumen de pago de la app no los muestra, y la regla cuenta el pago después de gastos.`,
    costsLabel: "Gastos de este mes, en dólares",
    after: (amount: string) => `Pago después de gastos: ${amount}`,
    save: "Guardar respuesta",
    missing: "Falta un dato en una línea. Agrégalo en la página de revisión.",
    plan: "Plan para completar el mes",
    needed: (h: string, by: string) => `Faltan ${h} horas antes del ${by}.`,
    step: (h: string, org: string) => `${h} horas en ${org}`,
    shifts: (n: number, h: string) =>
      n === 1 ? `más o menos 1 turno de ${h} horas` : `más o menos ${n} turnos de ${h} horas`,
    orPay: (amount: string) => `O ${amount} más de pago este mes.`,
    checked: "Revisado con las reglas: cada paso por sí solo cumpliría la regla.",
    noSteps: "Agrega horas de trabajo, estudio o voluntariado, o pago, en la página para agregar.",
    done: "Tus pruebas confirmadas cumplen la regla este mes.",
    rule: "Regla",
    footer: "Solo tú puedes confirmar una línea. Tu estado decide.",
    error: "No funcionó. Inténtalo otra vez.",
  },
};

const run = (read: boolean) =>
  callAction("do_my_month", { read }, { method: "POST" }) as Promise<MonthWorkResult>;

/** The month's paperwork as cards. The same action runs from chat and Telegram. */
export function MonthWork({
  initial = null,
  onChanged,
  autoLoad = false,
}: {
  initial?: MonthWorkResult | null;
  onChanged?: () => void;
  autoLoad?: boolean;
}) {
  const lang = useLanguage(),
    es = lang === "es",
    copy = COPY[es ? "es" : "en"],
    link = (path: string) => languageLink(path, lang);
  const [data, setData] = useState<MonthWorkResult | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [stuck, setStuck] = useState<string | null>(null);
  const [costs, setCosts] = useState("");
  const num = (value: number) =>
    value.toLocaleString(es ? "es-US" : "en-US", { maximumFractionDigits: 2 });
  const money = (cents: number) =>
    new Intl.NumberFormat(es ? "es-US" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  const day = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(es ? "es-US" : "en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });

  async function go(read: boolean, task?: () => Promise<unknown>) {
    setBusy(true);
    setError(false);
    try {
      if (task) await task();
      setData(await run(read));
      if (task) onChanged?.();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(id: string, version: number) {
    setStuck(null);
    setBusy(true);
    try {
      await callAction("confirm_evidence", { id, version }, { method: "POST", uiOnly: true });
    } catch {
      // A possible duplicate needs the side-by-side check on the review page.
      setStuck(id);
      setBusy(false);
      return;
    }
    await go(false);
    onChanged?.();
  }
  useEffect(() => {
    if (autoLoad && !initial) void go(false);
    // Load once, when a chat card arrives without its stored result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const line = (id: string) => data?.waiting.find((item) => item.id === id);
  const costsCents = Math.round(Number(costs.replace(/[$,\s]/g, "")) * 100);
  const costsOk = costs.trim() !== "" && Number.isSafeInteger(costsCents) && costsCents >= 0;

  if (!data)
    return (
      <section className="card month-work" aria-live="polite">
        <button type="button" disabled={busy} onClick={() => void go(true)}>
          {busy ? copy.working : copy.button}
        </button>
        {error && (
          <p role="alert" className="error">
            {copy.error}
          </p>
        )}
      </section>
    );

  const q = data.question;
  const qLine = q ? line(q.lineId) : undefined;
  const gross = q?.key === "business-costs" ? (q.grossPayCents ?? 0) : 0;
  return (
    <section className="card month-work" aria-labelledby={`mw-${data.month}`} aria-live="polite">
      <h2 id={`mw-${data.month}`}>{copy.title}</h2>
      <div className="mw-status" data-status={data.now.status}>
        <strong>
          {copy.status}: {STATUS[es ? "es" : "en"][data.now.status] ?? data.now.status}
        </strong>
        {data.now.hours !== null && (
          <span>{copy.hours(num(data.now.hours), data.targetHours)}</span>
        )}
        {data.ifConfirmed?.hours != null && data.ifConfirmed.hours !== data.now.hours && (
          <span className="mw-if">{copy.ifConfirmed(num(data.ifConfirmed.hours))}</span>
        )}
      </div>

      {(data.read.length > 0 || data.unread > 0) && (
        <div className="mw-card">
          {data.read.length > 0 && (
            <p>
              {copy.read(
                data.read.length,
                data.read.reduce((sum, item) => sum + item.lines, 0),
              )}
            </p>
          )}
          {data.read.some((item) => item.outcome === "budget-used") && <p>{copy.budget}</p>}
          {data.unread > 0 && <p>{copy.unread(data.unread)}</p>}
        </div>
      )}

      {q && (
        <div className="mw-card mw-question">
          <h3>{copy.question}</h3>
          {q.key === "business-costs" && qLine ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!costsOk) return;
                const income = qLine.fields.income!;
                void go(false, () =>
                  callAction(
                    "edit_evidence",
                    {
                      id: qLine.id,
                      version: qLine.version,
                      fields: {
                        ...qLine.fields,
                        income: {
                          ...income,
                          netEarningsCents: Math.max(0, gross - costsCents),
                          costsConfirmed: true,
                        },
                      },
                    },
                    { method: "POST", uiOnly: true },
                  ),
                ).then(() => setCosts(""));
              }}
            >
              <p>{copy.costs(q.organization ?? "")}</p>
              <label>
                {copy.costsLabel}
                <input
                  inputMode="decimal"
                  value={costs}
                  onChange={(event) => setCosts(event.target.value)}
                />
              </label>
              {costsOk && <p className="note">{copy.after(money(Math.max(0, gross - costsCents)))}</p>}
              <button type="submit" disabled={busy || !costsOk}>
                {copy.save}
              </button>
            </form>
          ) : (
            <p>
              {copy.missing} <a href={link("/review")}>{copy.edit}</a>
            </p>
          )}
        </div>
      )}

      {data.waiting.length > 0 && (
        <div className="mw-card">
          <h3>{copy.waiting}</h3>
          <ul className="mw-lines">
            {data.waiting.map((item) => (
              <li key={item.id}>
                <p>{lineText(item.fields as LineFields, es ? "es" : "en")}</p>
                <p className="note">{item.fromDocument ? copy.fromFile : copy.fromWords}</p>
                <div className="actions">
                  <button
                    type="button"
                    disabled={busy || (q?.key === "business-costs" && q.lineId === item.id)}
                    onClick={() => void confirm(item.id, item.version)}
                  >
                    {copy.confirm}
                  </button>
                  <a className="button secondary" href={link("/review")}>
                    {copy.edit}
                  </a>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      void go(false, () =>
                        callAction(
                          "reject_evidence",
                          { id: item.id, version: item.version },
                          { method: "POST", uiOnly: true },
                        ),
                      )
                    }
                  >
                    {copy.reject}
                  </button>
                </div>
                {stuck === item.id && (
                  <p role="alert">
                    <a href={link("/review")}>{copy.review}</a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.plan && (
        <div className="mw-card mw-plan">
          <h3>{copy.plan}</h3>
          <p>{copy.needed(num(data.plan.hoursNeeded), day(data.monthEnd))}</p>
          {data.plan.steps.length > 0 ? (
            <>
              <ul>
                {data.plan.steps.map((step) => (
                  <li key={`${step.kind}-${step.organization}`}>
                    {copy.step(num(step.hours), step.organization)}
                    {step.shifts && step.shiftHours
                      ? ` (${copy.shifts(step.shifts, num(step.shiftHours))})`
                      : ""}
                  </li>
                ))}
              </ul>
              <p className="note">{copy.checked}</p>
            </>
          ) : (
            <p>
              <a href={link("/add")}>{copy.noSteps}</a>
            </p>
          )}
          {data.plan.payNeededCents !== null && data.plan.payNeededCents > 0 && (
            <p>{copy.orPay(money(data.plan.payNeededCents))}</p>
          )}
        </div>
      )}

      {data.done && (
        <div className="mw-card mw-done">
          <p>{copy.done}</p>
        </div>
      )}

      <p className="rule">
        {copy.rule}: <a href={ruleUrl(data.now.citation)}>{data.now.citation}</a>
      </p>
      <p className="note">{copy.footer}</p>
      <button type="button" className="secondary" disabled={busy} onClick={() => void go(true)}>
        {busy ? copy.working : copy.again}
      </button>
      {error && (
        <p role="alert" className="error">
          {copy.error}
        </p>
      )}
    </section>
  );
}
