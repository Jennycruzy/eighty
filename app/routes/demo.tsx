import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { demoCopy, fill, type DemoPerson } from "../lib/demo";
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
}
interface DemoMonth {
  person: DemoPerson;
  thisMonth: MonthSummary;
  lastMonth: MonthSummary;
  waiting: number;
}

const ruleLink = (citation: string) => {
  const section = citation.match(/435\.(\d{3})/)?.[1] ?? "552";
  return `https://www.ecfr.gov/current/title-42/section-435.${section}`;
};

export default function DemoMonthPage() {
  const lang = useLanguage(),
    es = lang === "es",
    link = (path: string) => languageLink(path, lang);
  const copy = demoCopy(lang);
  const [data, setData] = useState<DemoMonth | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error" | "denied">(
    "loading",
  );
  async function load() {
    setState("loading");
    try {
      setData(
        (await callAction("demo_month", {}, { method: "GET" })) as DemoMonth,
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
    return (
      <section
        className="result"
        data-status={month.status}
        aria-labelledby={`demo-${month.month}`}
      >
        <Heading id={`demo-${month.month}`}>
          {title} · {monthName(month.month)}
        </Heading>
        <p className="status" data-status={month.status}>
          {copy.month.status[month.status]}
        </p>
        {month.hours !== null && (
          <p>
            {fill(copy.month.hours, {
              hours: month.hours.toLocaleString(es ? "es-US" : "en-US"),
              target: month.targetHours,
            })}
          </p>
        )}
        {month.amountCents !== null && (
          <p>{fill(copy.month.pay, { amount: money(month.amountCents) })}</p>
        )}
        {month.missing.length > 0 && (
          <p>{fill(copy.month.missing, { count: month.missing.length })}</p>
        )}
        <p>
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
        <p>{copy.month.notDemo}</p>
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
      <p className="eyebrow">{copy.month.eyebrow}</p>
      <h1>{fill(copy.month.title, { name: person.name })}</h1>
      <p className="intro">{person.about}</p>
      {summary(copy.month.thisMonth, data.thisMonth, true)}
      <p>{copy.month.next[data.person]}</p>
      <div className="actions">
        <Link className="button" to={link("/add")}>
          {copy.month.add}
        </Link>
        <Link className="button secondary" to={link("/review")}>
          {copy.month.review}
        </Link>
      </div>
      <p role="status">
        {data.waiting
          ? fill(copy.month.waiting, { count: data.waiting })
          : copy.month.none}
      </p>
      {summary(copy.month.lastMonth, data.lastMonth, false)}
      <p className="note">{copy.month.stateDecides}</p>
    </>
  );
}
