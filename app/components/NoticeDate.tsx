import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";

import { ruleUrl } from "../../shared/telegram-words";
import { useLanguage } from "../lib/language";

interface NoticeState {
  printed: string | null;
  arrived: string | null;
  today: string;
  dates: {
    citation: string;
    countedAsReceived: string | null;
    reminderDeadline: string | null;
    possibleLaterDeadline: string | null;
    laterArrivalNeedsProof: boolean;
  } | null;
}

const COPY = {
  en: {
    title: "A letter from the state?",
    intro: "Type the date printed on it. The rule gives you a reply date; Telegram check-ins remind you 7 days and 1 day before.",
    printed: "Date printed on the letter",
    arrived: "Day it came, if it came late (optional)",
    save: "Get my reply date",
    received: (d: string) => `Counted as received ${d}.`,
    replyBy: "Reply by",
    left: (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `${n} days from today`),
    late: (d: string) => `It came late: keep proof, like the envelope. With it, the date may be ${d}; plan for the earlier one.`,
    remove: "Remove these dates",
    rule: "Rule",
    error: "Check the dates and try again.",
  },
  es: {
    title: "¿Una carta del estado?",
    intro: "Escribe la fecha impresa en la carta. La regla te da una fecha para responder; la revisión por Telegram te lo recuerda 7 días antes y el día anterior.",
    printed: "Fecha impresa en la carta",
    arrived: "Día en que llegó, si llegó tarde (opcional)",
    save: "Ver mi fecha para responder",
    received: (d: string) => `Se cuenta como recibida el ${d}.`,
    replyBy: "Responde a más tardar el",
    left: (n: number) => (n === 0 ? "hoy" : n === 1 ? "mañana" : `faltan ${n} días`),
    late: (d: string) => `Llegó tarde: guarda una prueba, como el sobre. Con ella, la fecha puede ser el ${d}; planea con la más temprana.`,
    remove: "Borrar estas fechas",
    rule: "Regla",
    error: "Revisa las fechas e inténtalo otra vez.",
  },
};

const call = (input: Record<string, unknown>) =>
  callAction("notice_date", input, { method: "POST", uiOnly: true }) as Promise<NoticeState>;

/** The state letter's dates and the reply date the notice rule gives. */
export function NoticeDate() {
  const lang = useLanguage(),
    es = lang === "es",
    copy = COPY[es ? "es" : "en"];
  const [state, setState] = useState<NoticeState | null>(null);
  const [printed, setPrinted] = useState("");
  const [arrived, setArrived] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    call({ op: "status" }).then(setState).catch(() => {});
  }, []);
  const day = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(es ? "es-US" : "en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  async function act(input: Record<string, unknown>) {
    setBusy(true);
    setError(false);
    try {
      setState(await call(input));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  if (!state) return null;
  const d = state.dates;
  const left =
    d?.reminderDeadline
      ? Math.round((Date.parse(`${d.reminderDeadline}T00:00:00Z`) - Date.parse(`${state.today}T00:00:00Z`)) / 86_400_000)
      : null;
  return (
    <section className="card notice-date" aria-labelledby="notice-title">
      <h2 id="notice-title">{copy.title}</h2>
      {d?.reminderDeadline ? (
        <div className="mw-card mw-question">
          <p>{copy.received(day(d.countedAsReceived!))}</p>
          <p>
            <strong>
              {copy.replyBy} {day(d.reminderDeadline)}
            </strong>
            {left !== null && left >= 0 ? ` (${copy.left(left)})` : ""}
          </p>
          {d.laterArrivalNeedsProof && d.possibleLaterDeadline && <p>{copy.late(day(d.possibleLaterDeadline))}</p>}
          <p className="rule">
            {copy.rule}: <a href={ruleUrl(d.citation)}>{d.citation}</a>
          </p>
          <button type="button" className="secondary" disabled={busy} onClick={() => void act({ op: "clear" })}>
            {copy.remove}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act({ op: "save", printed, arrived: arrived || null });
          }}
        >
          <p>{copy.intro}</p>
          <label>
            {copy.printed}
            <input type="date" required value={printed} max={state.today} onChange={(e) => setPrinted(e.target.value)} />
          </label>
          <label>
            {copy.arrived}
            <input type="date" value={arrived} max={state.today} onChange={(e) => setArrived(e.target.value)} />
          </label>
          <button type="submit" disabled={busy || !printed}>
            {copy.save}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {copy.error}
        </p>
      )}
    </section>
  );
}
