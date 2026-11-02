import { useState, useRef, useEffect } from "react";

import states from "../../data/states.json";
import { screenAnswers, type ScreenerAnswers } from "../../shared/screener";
import { useLanguage, languageLink } from "../lib/language";
const questions = [
  ["state", "Which state do you live in?", "¿En qué estado vives?"],
  ["age", "How old are you?", "¿Cuántos años tienes?"],
  [
    "pregnant",
    "Are you pregnant or covered for the time after pregnancy?",
    "¿Estás embarazada o tienes cobertura por el tiempo después del embarazo?",
  ],
  ["medicare", "Do you have Medicare?", "¿Tienes Medicare?"],
  [
    "child",
    "Are you a parent or guardian of a child age 13 or younger who relies on your care?",
    "¿Eres padre, madre o tutor de un niño de 13 años o menos que depende de tus cuidados?",
  ],
  [
    "care",
    "Do you care for someone with a disability?",
    "¿Cuidas a alguien con una discapacidad?",
  ],
  [
    "indian",
    "Are you American Indian or Alaska Native under the federal definition?",
    "¿Eres indígena americano o nativo de Alaska según la definición federal?",
  ],
  [
    "veteran",
    "Do you have a 100% VA disability rating?",
    "¿Tienes una calificación de discapacidad del 100% del VA?",
  ],
  [
    "treatment",
    "Are you in a treatment program?",
    "¿Estás en un programa de tratamiento?",
  ],
  [
    "snap",
    "Does your household get SNAP food help?",
    "¿Tu hogar recibe ayuda de alimentos SNAP?",
  ],
  [
    "foster",
    "Do you have Medicaid as a former foster youth?",
    "¿Tienes Medicaid como exjoven de crianza temporal?",
  ],
  [
    "health",
    "Does a health condition make it hard to work or follow this rule?",
    "¿Un problema de salud dificulta trabajar o cumplir esta regla?",
  ],
  [
    "tanf",
    "Do you get TANF cash help and meet its work rules?",
    "¿Recibes ayuda en efectivo de TANF y cumples sus reglas de trabajo?",
  ],
] as const;
export default function Check() {
  const lang = useLanguage(),
    es = lang === "es";
  const [answers, setAnswers] = useState<ScreenerAnswers>({}),
    [step, setStep] = useState(0);
  const questionField = useRef<HTMLFieldSetElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    (questionField.current || resultHeading.current)?.focus();
  }, [step]);
  const question = questions[step];
  const result = question ? null : screenAnswers(answers);
  function set(value: string) {
    setAnswers({ ...answers, [question![0]]: value });
  }
  return (
    <>
      <h1>{es ? "¿Me aplica la regla?" : "Does the rule apply to me?"}</h1>
      <p>
        {es
          ? "Puedes saltar cualquier pregunta. No guardamos las respuestas."
          : "You can skip any question. Nothing is saved."}
      </p>
      {question ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep(step + 1);
          }}
        >
          <p className="muted">
            {step + 1} / {questions.length}
          </p>
          <fieldset key={question[0]} ref={questionField} tabIndex={-1}>
            <legend>{es ? question[2] : question[1]}</legend>
            {question[0] === "state" ? (
              <>
                <label htmlFor="state">{es ? "Estado" : "State"}</label>
                <select
                  id="state"
                  value={answers.state || ""}
                  onChange={(e) => set(e.target.value)}
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
                <label htmlFor="group">
                  {es
                    ? "¿Qué grupo de Medicaid tienes? Si no sabes, puedes seguir."
                    : "Which Medicaid group are you in? You can keep going if you do not know."}
                </label>
                <select
                  id="group"
                  value={answers.group || ""}
                  onChange={(e) =>
                    setAnswers({ ...answers, group: e.target.value })
                  }
                >
                  <option value="">{es ? "No sé" : "Not sure"}</option>
                  <option value="expansion">
                    {es ? "Expansión para adultos" : "Adult expansion"}
                  </option>
                  <option value="1115">
                    {es ? "Programa especial 1115" : "1115 demonstration"}
                  </option>
                  <option value="other">
                    {es
                      ? "Otro grupo del plan estatal"
                      : "Another State plan group"}
                  </option>
                </select>
              </>
            ) : question[0] === "age" ? (
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
                  onChange={(e) => set(e.target.value)}
                />
              </>
            ) : (
              ["yes", "no", "unknown"].map((value) => (
                <label className="choice" key={value}>
                  <input
                    type="radio"
                    name={question[0]}
                    checked={(answers[question[0]] || "unknown") === value}
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
            <button>{es ? "Seguir" : "Next"}</button>
          </div>
        </form>
      ) : (
        <section
          className="result"
          data-status={result!.status}
          aria-live="polite"
        >
          <h2 ref={resultHeading} tabIndex={-1}>
            {result!.status === "Exempt"
              ? es
                ? "La regla no te aplica según estas respuestas"
                : "The rule does not apply based on these answers"
              : es
                ? "Aún no sabemos"
                : "Not sure yet"}
          </h2>
          <p>
            {result!.status === "Exempt"
              ? es
                ? "Guarda una prueba de la razón. Confirma con tu estado qué documento acepta."
                : "Keep proof of the reason. Ask your state what document it accepts."
              : es
                ? "Pregunta al estado por tu grupo de cobertura y si una exclusión te aplica. Cuidar a alguien, recibir SNAP o estar en tratamiento puede necesitar más datos."
                : "Ask your state about your coverage group and any exclusion. Caregiving, SNAP or treatment may need more facts."}
          </p>
          <details>
            <summary>{es ? "Cómo decidimos" : "How we decided"}</summary>
            <p>{result!.citation}</p>
            <a href="https://www.ecfr.gov/current/title-42/section-435.554">
              {es ? "Leer la regla" : "Read the rule"}
            </a>
          </details>
          <div className="actions">
            <a
              className="button"
              href={languageLink(
                answers.state
                  ? `/states/${answers.state.toLowerCase()}`
                  : "/states",
                lang,
              )}
            >
              {es ? "Buscar ayuda del estado" : "Find state help"}
            </a>
            <button className="secondary" onClick={() => setStep(0)}>
              {es ? "Revisar respuestas" : "Review answers"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
