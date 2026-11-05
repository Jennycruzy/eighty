import { useRef, useEffect } from "react";
import { Link } from "react-router";

import states from "../../data/states.json";
import en from "../../locales/en-US.json";
import esCopy from "../../locales/es-US.json";
import { coverageAnswers, visibleQuestions } from "../../shared/screener";
import { screenerResult } from "../../shared/screener-result";
import { useLanguage, languageLink } from "../lib/language";
import { useScreenerDraft } from "../lib/screener-draft";

export default function Check() {
  const lang = useLanguage(),
    es = lang === "es";
  const copy = (es ? esCopy : en).screener;
  const { answers, setAnswers, step, setStep } = useScreenerDraft();
  const field = useRef<HTMLFieldSetElement>(null),
    heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    (field.current || heading.current)?.focus();
  }, [step]);
  const questions = visibleQuestions(copy.questions, answers);
  const question = questions[step];
  const result = question ? null : screenerResult(answers);
  const explanation = result
    ? copy.reasons[result.reason as keyof typeof copy.reasons]
    : null;
  const set = (value: string) =>
    setAnswers(coverageAnswers({ ...answers, [question!.key]: value }));
  const citation =
    result?.reason === "care"
      ? "42 CFR 435.554(c)(3)"
      : result?.reason === "health"
        ? "42 CFR 435.554(c)(5)"
        : result?.reason === "snap"
          ? "42 CFR 435.554(c)(7)"
          : result?.reason === "treatment"
            ? "42 CFR 435.554(c)(8)"
            : result?.rule.citation;
  return (
    <>
      <h1>{es ? "¿Me aplica la regla?" : "Does the rule apply to me?"}</h1>
      <p>
        {es
          ? "Puedes saltar cualquier pregunta. Tus respuestas quedan solo en esta página hasta que decidas crear una cuenta. Se borran si cierras o recargas la página."
          : "You can skip any question. Your answers stay in this page until you choose to create an account. They clear if you close or reload the page."}
      </p>
      {question ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            set(
              answers[question.key] ??
                (["state", "age", "group"].includes(question.key)
                  ? ""
                  : "unknown"),
            );
            setStep(step + 1);
          }}
        >
          <p className="muted">
            {step + 1} / {questions.length}
          </p>
          <fieldset key={question.key} ref={field} tabIndex={-1}>
            <legend>{question.text}</legend>
            {question.key === "state" ? (
              <>
                <label htmlFor="state">{es ? "Estado" : "State"}</label>
                <select
                  id="state"
                  value={answers.state || ""}
                  onChange={(event) => set(event.target.value)}
                >
                  <option value="">
                    {es
                      ? "No sé / prefiero no responder"
                      : "Not sure / prefer not to say"}
                  </option>
                  {states.map((state) => (
                    <option key={state.code} value={state.code}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </>
            ) : question.key === "group" ? (
              ["expansion", "1115", "other", ""]
                .map(
                  (value) =>
                    [
                      value,
                      copy.groupChoices[
                        value as keyof typeof copy.groupChoices
                      ],
                    ] as const,
                )
                .map(([value, label]) => (
                  <label className="choice" key={value}>
                    <input
                      type="radio"
                      name="group"
                      value={value}
                      checked={(answers.group || "") === value}
                      onChange={() => set(value)}
                    />
                    {label}
                  </label>
                ))
            ) : question.key === "age" ? (
              <>
                <label htmlFor="age">
                  {es ? "Edad (opcional)" : "Age (optional)"}
                </label>
                <input
                  id="age"
                  inputMode="numeric"
                  type="number"
                  min="0"
                  max="120"
                  value={answers.age || ""}
                  onChange={(event) => set(event.target.value)}
                />
              </>
            ) : (
              ["yes", "no", "unknown"].map((value) => (
                <label className="choice" key={value}>
                  <input
                    type="radio"
                    name={question.key}
                    checked={(answers[question.key] || "unknown") === value}
                    onChange={() => set(value)}
                  />
                  {value === "yes"
                    ? es
                      ? "Sí"
                      : "Yes"
                    : value === "no"
                      ? "No"
                      : es
                        ? "No sé / prefiero no responder"
                        : "Not sure / prefer not to say"}
                </label>
              ))
            )}
          </fieldset>
          <div className="actions">
            {step > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => setStep(step - 1)}
              >
                {es ? "Atrás" : "Back"}
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={() => {
                set(
                  ["state", "age", "group"].includes(question.key)
                    ? ""
                    : "unknown",
                );
                setStep(step + 1);
              }}
            >
              {es ? "No sé" : "I’m not sure"}
            </button>
            <button>{es ? "Seguir" : "Next"}</button>
          </div>
        </form>
      ) : (
        <section
          className="result"
          data-status={result!.status}
          data-outcome={result!.outcome}
          aria-live="polite"
        >
          <h2 ref={heading} tabIndex={-1}>
            {result!.outcome === "excluded"
              ? es
                ? "La regla no te aplica según estas respuestas"
                : "The rule does not apply based on these answers"
              : result!.outcome === "conditional"
                ? es
                  ? "La regla puede aplicarte. Esto es lo que cuenta."
                  : "The rule may apply. Here’s what counts."
                : es
                  ? "Aún no sabemos"
                  : "Not sure yet"}
          </h2>
          <p>{explanation!.reason}</p>
          {result!.outcome === "conditional" && (
            <ul>
              <li>
                {es
                  ? "Trabajo, servicio o un programa de trabajo que cuente."
                  : "Work, service or a work program that counts."}
              </li>
              <li>
                {es
                  ? "Estudios al menos a medio tiempo. Menos estudios pueden contar como horas."
                  : "School at least half-time. Less school can still count as hours."}
              </li>
              <li>
                {es
                  ? "Suficientes ingresos según la regla. Tu estado confirma la cantidad que cuenta."
                  : "Enough income under the rule. Your state confirms the amount that counts."}
              </li>
            </ul>
          )}
          <h3>{es ? "Qué guardar como prueba" : "What to keep as proof"}</h3>
          <p>{explanation!.proof}</p>
          <details>
            <summary>{es ? "Cómo decidimos" : "How we decided"}</summary>
            <p>{citation}</p>
            <a
              href={`https://www.ecfr.gov/current/title-42/section-${citation?.includes("435.554") ? "435.554" : citation?.includes("435.119(b)(4)") ? "435.119" : "435.551"}`}
            >
              {es ? "Leer la regla" : "Read the rule"}
            </a>
            {result!.outcome === "conditional" && (
              <p>
                <a href="https://www.ecfr.gov/current/title-42/section-435.552">
                  42 CFR 435.552 · {es ? "Lo que cuenta" : "What counts"}
                </a>
              </p>
            )}
          </details>
          <div className="actions">
            <Link className="button" to={languageLink("/check/account", lang)}>
              {es ? "Seguir mis meses" : "Track my months"}
            </Link>
            <Link
              className="button secondary"
              to={languageLink(
                answers.state
                  ? `/states/${answers.state.toLowerCase()}`
                  : "/states",
                lang,
              )}
            >
              {es ? "Buscar ayuda del estado" : "Find state help"}
            </Link>
            <button className="secondary" onClick={() => setStep(0)}>
              {es ? "Revisar respuestas" : "Review answers"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
