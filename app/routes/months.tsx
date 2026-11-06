import { MonthHelper } from "../components/MonthHelper";
import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import type { saveCoverageAnswer } from "../../server/lib/coverage-answer";
import { coverageFacts } from "../../shared/screener";
import en from "../../locales/en-US.json";
import es from "../../locales/es-US.json";
import type { checkMemberMonth } from "../../server/lib/member-month";
import { exampleCopy, fill } from "../lib/example";
import { useLanguage, languageLink } from "../lib/language";

export { headers } from "./example";
type Months = Awaited<ReturnType<typeof checkMemberMonth>>;

export default function MonthsPage() {
  const lang = useLanguage();
  const copy = (lang === "es" ? es : en).months;
  const common = exampleCopy(lang).month;
  const { m } = useParams();
  const [data, setData] = useState<Months | null>(null);
  const [error, setError] = useState(false);
  const link = (path: string) => languageLink(path, lang);
  async function load() {
    setError(false);
    setData(null);
    try {
      setData(
        (await callAction("check_month", m === undefined ? {} : { month: m }, {
          method: "GET",
        })) as Months,
      );
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    void load();
  }, [m]);
  const money = (value: number) =>
    new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", {
      style: "currency",
      currency: "USD",
    }).format(value / 100);
  const monthName = (value: string) => {
    const date = new Date(`${value}-01T12:00:00Z`);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(lang === "es" ? "es-US" : "en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        });
  };
  if (error)
    return (
      <section role="alert">
        <p>{common.error}</p>
        <button onClick={() => void load()}>{common.retry}</button>
      </section>
    );
  if (!data)
    return (
      <p role="status" aria-live="polite">
        {common.loading}
      </p>
    );
  const months = data.selected ? [data.selected] : data.months;
  return (
    <>
      <h1>{m === undefined ? copy.title : copy.detail}</h1>
      <div className="actions">
        <Link className="button" to={link("/add")}>
          {common.add}
        </Link>
        <Link className="button secondary" to={link("/review")}>
          {common.review}
        </Link>
      </div>
      <p role="status">
        {data.waiting
          ? fill(common.waiting, { count: data.waiting })
          : common.none}
      </p>
      {months.map((month, index) => {
        const reason = copy.reasons[month.basis as keyof typeof copy.reasons];
        const section = month.citation.match(/435\.(\d{3})/)?.[1] ?? "552";
        const questions = [
          ...new Map(
            month.missing.map((key) => {
              const group = key.split(".")[0] ?? "";
              const text =
                copy.questionsByFact[
                  key as keyof typeof copy.questionsByFact
                ] ??
                copy.questionsByFact[
                  group as keyof typeof copy.questionsByFact
                ] ??
                copy.unknownQuestion;
              const path = [
                "income",
                "education",
                "evidence",
                "evidenceComplete",
              ].includes(group)
                ? "/review"
                : ["state", "hardship", "seasonal", "exceptions"].includes(
                      group,
                    ) ||
                    key.includes("Eligible") ||
                    key.includes("Coverage") ||
                    key.includes("Enrolled")
                  ? "/help"
                  : "/check";
              return [text, { text, path, fact: key }];
            }),
          ).values(),
        ];
        return (
          <section
            className="result"
            data-status={month.status}
            key={month.month}
            aria-labelledby={`month-${month.month}`}
          >
            <h2 id={`month-${month.month}`}>
              <Link to={link(`/months/${encodeURIComponent(month.month)}`)}>
                {m === undefined && index < 2
                  ? `${index === 0 ? common.thisMonth : common.lastMonth} · `
                  : ""}
                {monthName(month.month)}
              </Link>
            </h2>
            <p className="status" data-status={month.status}>
              {common.status[month.status]}
            </p>
            <p>
              {reason ?? (lang === "es" ? copy.unknownQuestion : month.basis)}
            </p>
            {month.hours !== null && (
              <p>
                {fill(common.hours, {
                  hours: month.hours,
                  target: month.targetHours,
                })}
              </p>
            )}
            {month.educationHours !== null && m !== undefined && (
              <p>
                {month.educationCredits !== null
                  ? fill(copy.schoolMath, {
                      credits: month.educationCredits,
                      hours: month.educationHours,
                    })
                  : fill(copy.schoolHours, { hours: month.educationHours })}
              </p>
            )}
            {month.amountCents !== null && (
              <p>{fill(common.pay, { amount: money(month.amountCents) })}</p>
            )}
            <p>{copy.incomeTarget}</p>
            <p>
              {common.rule}:{" "}
              <a
                href={`https://www.ecfr.gov/current/title-42/section-435.${section}`}
              >
                {month.citation}
              </a>
            </p>
            {m !== undefined && (
              <>
                <h3>{copy.lines}</h3>
                {month.lines.length === 0 && <p>{copy.none}</p>}
                <ul>
                  {month.lines.map((line) => (
                    <li key={line.id}>
                      <p>
                        {copy.kinds[line.fields.kind]} ·{" "}
                        {line.fields.income?.receivedOn ??
                          line.fields.start ??
                          line.fields.education?.termStart}{" "}
                        – {line.fields.end ?? line.fields.education?.termEnd}
                      </p>
                      <p>{line.fields.organization}</p>
                      {month.counted.find((item) => item.id === line.id) && (
                        <p>
                          {
                            month.counted.find((item) => item.id === line.id)!
                              .hours
                          }{" "}
                          {copy.hours}
                        </p>
                      )}
                      {line.fields.income?.kind === "wages" && (
                        <p>
                          {fill(copy.wageMath, {
                            gross: money(line.fields.income.grossPayCents!),
                            deductions: money(
                              line.fields.income.preTaxDeductionsCents!,
                            ),
                            net: money(
                              line.fields.income.grossPayCents! -
                                line.fields.income.preTaxDeductionsCents!,
                            ),
                          })}
                        </p>
                      )}
                      {line.fields.income?.kind === "self-employment" && (
                        <p>
                          {money(
                            line.fields.income.kind === "self-employment"
                              ? (line.fields.income.netEarningsCents ?? 0)
                              : (line.fields.income.grossPayCents ?? 0) -
                                  (line.fields.income.preTaxDeductionsCents ??
                                    0),
                          )}
                        </p>
                      )}
                      <p>
                        {copy.source}:{" "}
                        {line.fromDocument ? copy.document : copy.typed}
                      </p>
                    </li>
                  ))}
                </ul>
                {questions.length > 0 && (
                  <>
                    <h3>{copy.questions}</h3>
                    <ul>
                      {questions.map(({ text, path, fact }) => (
                        <li key={text}>
                          {fact in coverageFacts ? (
                            <CoverageAnswer
                              key={`${month.month}-${fact}`}
                              answerKey={
                                coverageFacts[
                                  fact as keyof typeof coverageFacts
                                ]
                              }
                              text={text}
                              lang={lang}
                              reload={load}
                            />
                          ) : (
                            <Link to={link(path)}>{text}</Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
            {m === undefined && month.missing.length > 0 && (
              <p>{fill(common.missing, { count: month.missing.length })}</p>
            )}
          </section>
        );
      })}
      {m !== undefined && (
        <p>
          <Link to={link("/months")}>{copy.back}</Link>
        </p>
      )}
      <MonthHelper />
      <p className="note">{common.stateDecides}</p>
    </>
  );
}

function CoverageAnswer({
  answerKey,
  text,
  lang,
  reload,
}: {
  answerKey: (typeof coverageFacts)[keyof typeof coverageFacts];
  text: string;
  lang: string;
  reload: () => Promise<void>;
}) {
  const copy = lang === "es" ? es : en;
  const [value, setValue] = useState(answerKey === "group" ? "" : "unknown");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const choices: [string, string][] =
    answerKey === "group"
      ? ["expansion", "1115", "other", ""].map((value): [string, string] => [
          value,
          copy.screener.groupChoices[
            value as keyof typeof copy.screener.groupChoices
          ],
        ])
      : [
          ["yes", lang === "es" ? "Sí" : "Yes"],
          ["no", "No"],
          ["unknown", lang === "es" ? "No sé" : "Not sure"],
        ];
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(false);
        try {
          await callAction(
            "save_coverage_answer",
            {
              answers: { [answerKey]: value } as NonNullable<
                Parameters<typeof saveCoverageAnswer>[0]["answers"]
              >,
            },
            { method: "POST", uiOnly: true },
          );
          await reload();
        } catch {
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <legend>{text}</legend>
        {choices.map(([choice, label]) => (
          <label className="choice" key={choice}>
            <input
              type="radio"
              name={answerKey}
              value={choice}
              checked={value === choice}
              onChange={() => setValue(choice)}
            />
            {label}
          </label>
        ))}
      </fieldset>
      {error && (
        <p role="alert">
          {exampleCopy(lang === "es" ? "es" : "en").month.error}
        </p>
      )}
      <button disabled={busy}>{copy.months.saveAnswer}</button>
    </form>
  );
}
