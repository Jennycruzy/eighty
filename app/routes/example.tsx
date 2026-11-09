import { MonthHelper } from "../components/MonthHelper";
import { Rings } from "../components/Rings";
import { TelegramLink } from "../components/TelegramLink";
import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { exampleCopy, fill, type ExamplePerson } from "../lib/example";
import { useLanguage, languageLink } from "../lib/language";

export function headers() {
  return {
    "x-agent-native-ssr-max-age": "0",
    "Cache-Control": "private, no-store",
  };
}
type Status = "Meets" | "Exempt" | "Deemed" | "Short" | "Not sure yet";
interface MonthSummary {
  month: string;
  status: Status;
  citation: string;
  hours: number | null;
  targetHours: number;
  amountCents: number | null;
  missing: string[];
  explanation?: string;
  explanationEs?: string;
  ifConfirmed?: {
    status: Status;
    hours: number | null;
    amountCents: number | null;
  } | null;
}
interface ExampleMonth {
  person: ExamplePerson;
  thisMonth: MonthSummary;
  lastMonth: MonthSummary;
  waiting: number;
}

const ruleLink = (citation: string) => {
  const section = citation.match(/435\.(\d{3})/)?.[1] ?? "552";
  return `https://www.ecfr.gov/current/title-42/section-435.${section}`;
};

export default function ExampleMonthPage() {
  const lang = useLanguage(),
    es = lang === "es",
    link = (path: string) => languageLink(path, lang);
  const copy = exampleCopy(lang);
  const [data, setData] = useState<ExampleMonth | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "denied">(
    "loading",
  );
  async function load() {
    setState("loading");
    try {
      setData(
        (await callAction(
          "example_month",
          {},
          { method: "GET" },
        )) as ExampleMonth,
      );
      setState("ready");
    } catch (error) {
      const code = (error as { status?: number })?.status;
      setState(code === 401 || code === 403 ? "denied" : "error");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  // Proof sent from a phone shows up here without a reload.
  useEffect(() => {
    if (state !== "ready") return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      callAction("example_month", {}, { method: "GET" })
        .then((result) => setData(result as ExampleMonth))
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(timer);
  }, [state]);
  const monthName = (month: string) =>
    new Date(`${month}-01T12:00:00Z`).toLocaleDateString(
      es ? "es-US" : "en-US",
      { month: "long", year: "numeric", timeZone: "UTC" },
    );
  const money = (cents: number) =>
    new Intl.NumberFormat(es ? "es-US" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  function summary(title: string, month: MonthSummary, main: boolean) {
    const Heading = main ? "h2" : "h3";
    const plain = es ? month.explanationEs : month.explanation;
    return (
      <section
        className="month-panel result"
        data-status={month.status}
        aria-labelledby={`example-${month.month}`}
      >
        <header>
          <Heading id={`example-${month.month}`}>
            {title} · {monthName(month.month)}
          </Heading>
          <p className="status" data-status={month.status}>
            {copy.month.status[month.status]}
          </p>
        </header>
        <Rings
          title={`${title} · ${monthName(month.month)}`}
          values={{
            hours: month.hours,
            amountCents: month.amountCents,
            ifConfirmed: month.ifConfirmed ?? null,
          }}
        />
        {plain && <p className="plain">{plain}</p>}
        {month.missing.length > 0 && (
          <p className="note">
            {fill(copy.month.missing, { count: month.missing.length })}
          </p>
        )}
        <p className="rule">
          {copy.month.rule}:{" "}
          <a href={ruleLink(month.citation)}>{month.citation}</a>
        </p>
      </section>
    );
  }
  if (state === "loading")
    return (
      <p role="status" aria-live="polite">
        {copy.month.loading}
      </p>
    );
  if (state === "denied")
    return (
      <section role="alert">
        <p>{copy.month.notExample}</p>
        <a className="button" href={link("/")}>
          {copy.month.home}
        </a>
      </section>
    );
  if (state === "error" || !data)
    return (
      <section role="alert">
        <p>{copy.month.error}</p>
        <button type="button" onClick={() => void load()}>
          {copy.month.retry}
        </button>
      </section>
    );
  const person = copy.people[data.person];
  return (
    <>
      <h1>{fill(copy.month.title, { name: person.name })}</h1>
      <p className="intro">{person.about}</p>
      {summary(copy.month.thisMonth, data.thisMonth, true)}
      <p>{copy.month.next[data.person]}</p>
      <p className={data.waiting ? "waiting-pill" : "waiting-pill none"} role="status">
        {data.waiting
          ? fill(copy.month.waiting, { count: data.waiting })
          : copy.month.none}
      </p>
      <div className="actions">
        <Link className="button" to={link("/add")}>
          {copy.month.add}
        </Link>
        <Link className="button secondary" to={link("/review")}>
          {copy.month.review}
        </Link>
      </div>
      <TelegramLink />
      <MonthHelper />
      {summary(copy.month.lastMonth, data.lastMonth, false)}
      <p className="note">{copy.month.stateDecides}</p>
    </>
  );
}
