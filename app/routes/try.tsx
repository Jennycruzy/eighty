import { useState } from "react";

import type { RuleResult } from "../../server/rules/types";
import {
  checkTryMonth,
  type TryFill,
  type TryInput,
} from "../../shared/try-month";
import { TryReader } from "../components/evidence/TryReader";
import { MissingFacts } from "../components/public/MissingFacts";
import { ResultMath } from "../components/public/ResultMath";
import { useLanguage, languageLink } from "../lib/language";
export default function TryMonth() {
  const lang = useLanguage(),
    es = lang === "es";
  const [form, setForm] = useState({
      month: "",
      kind: "wages",
      gross: "",
      deductions: "",
      net: "",
      costsConfirmed: false,
      hours: "",
      confirmed: false,
    }),
    [result, setResult] = useState<RuleResult | null>(null),
    [working, setWorking] = useState(false);
  const set = (key: string, value: string | boolean) => {
    setForm({ ...form, [key]: value });
    setResult(null);
  };
  // The reader only suggests numbers; the visitor checks them and confirms.
  function fillFromReading(fill: TryFill) {
    setForm((current) => ({
      ...current,
      month: fill.month || current.month,
      kind: fill.kind || current.kind,
      gross: fill.gross,
      deductions: fill.deductions,
      net: fill.net,
      hours: fill.hours,
      costsConfirmed: false,
      confirmed: false,
    }));
    setResult(null);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      const input: TryInput = {
        ...form,
        asOf: new Date().toISOString().slice(0, 10),
      };
      setResult(checkTryMonth(input));
    } finally {
      setWorking(false);
    }
  }
  const status =
    result?.status === "Meets"
      ? es
        ? "Cumple la prueba de trabajo o pago"
        : "Meets the work or pay test"
      : result?.status === "Short"
        ? es
          ? "Falta para llegar a la meta"
          : "Below the line"
        : es
          ? "Aún no sabemos"
          : "Not sure yet";
  return (
    <>
      <p className="eyebrow">
        {es ? "Sin cuenta · No se guarda nada" : "No account · Nothing saved"}
      </p>
      <h1>{es ? "Prueba con tu propio mes" : "Try it on your own month"}</h1>
      <p>
        {es
          ? "Revisa la parte de trabajo y pago de la regla federal. Esto no revisa todas las exclusiones ni las opciones de tu estado."
          : "Check the work and pay part of the federal rule. This does not check all exclusions or your state’s choices."}
      </p>
      <TryReader
        es={es}
        onFill={fillFromReading}
        onTypeInstead={() => document.getElementById("month")?.focus()}
      />
      <p className="note">
        {es
          ? "Puedes escribir los números. No pongas tu nombre ni número de caso."
          : "You can type the numbers. Do not enter your name or case number."}
      </p>
      <form onSubmit={submit}>
        <label htmlFor="month">{es ? "Mes" : "Month"}</label>
        <input
          id="month"
          type="month"
          required
          value={form.month}
          onChange={(e) => set("month", e.target.value)}
        />
        <label htmlFor="kind">
          {es ? "Tipo de ingreso" : "Type of income"}
        </label>
        <select
          id="kind"
          value={form.kind}
          onChange={(e) => set("kind", e.target.value)}
        >
          <option value="wages">
            {es ? "Pago de un empleo" : "Wages from a job"}
          </option>
          <option value="gig">
            {es
              ? "Trabajo por mi cuenta o por aplicación"
              : "Gig or self-employment"}
          </option>
          <option value="none">
            {es ? "Solo horas de trabajo" : "Work hours only"}
          </option>
        </select>
        {form.kind === "wages" && (
          <>
            <label htmlFor="gross">
              {es ? "Pago bruto del mes ($)" : "Monthly gross pay ($)"}
            </label>
            <input
              id="gross"
              inputMode="decimal"
              value={form.gross}
              onChange={(e) => set("gross", e.target.value)}
            />
            <label htmlFor="deductions">
              {es
                ? "Deducciones antes de impuestos que muestra el recibo ($)"
                : "Pre-tax deductions shown on the stub ($)"}
            </label>
            <input
              id="deductions"
              inputMode="decimal"
              value={form.deductions}
              onChange={(e) => set("deductions", e.target.value)}
            />
            <p className="note">
              {es
                ? "Escribe 0 si no hay. No restes los impuestos ni las deducciones después de impuestos. Si no sabes, deja el campo vacío."
                : "Type 0 if there are none. Do not subtract tax withholding or after-tax deductions. If you do not know, leave it blank."}
            </p>
          </>
        )}
        {form.kind === "gig" && (
          <>
            <label htmlFor="net">
              {es
                ? "Ganancias netas del mes después de gastos ($)"
                : "Monthly net earnings after costs ($)"}
            </label>
            <input
              id="net"
              inputMode="decimal"
              value={form.net}
              onChange={(e) => set("net", e.target.value)}
            />
            <label className="choice">
              <input
                type="checkbox"
                checked={form.costsConfirmed}
                onChange={(e) => set("costsConfirmed", e.target.checked)}
              />
              {es
                ? "Ya revisé y resté los gastos de mi negocio."
                : "I checked and subtracted my business costs."}
            </label>
          </>
        )}
        <label htmlFor="hours">
          {es
            ? "Horas de trabajo ya hechas en este mes (opcional)"
            : "Work hours already completed in this month (optional)"}
        </label>
        <input
          id="hours"
          inputMode="decimal"
          value={form.hours}
          onChange={(e) => set("hours", e.target.value)}
        />
        <label className="choice">
          <input
            type="checkbox"
            checked={form.confirmed}
            onChange={(e) => set("confirmed", e.target.checked)}
          />
          {es ? "Revisé estos números." : "I checked these numbers."}
        </label>
        <button disabled={working}>
          {working
            ? es
              ? "Revisando…"
              : "Checking…"
            : es
              ? "Revisar mi mes"
              : "Check my month"}
        </button>
      </form>
      {result && (
        <section
          className="result"
          data-status={result.status}
          aria-live="polite"
        >
          <p className="status" data-status={result.status}>
            {status}
          </p>
          <p>
            {es
              ? "Pago que nos mostraste; el estado puede contarlo de otra forma."
              : "Pay you showed us; the state may count it differently."}
          </p>
          <MissingFacts fields={result.missing} spanish={es} />
          <details>
            <summary>{es ? "Cómo decidimos" : "How we decided"}</summary>
            <p>{result.citation}</p>
            <p>
              <a href="https://www.ecfr.gov/current/title-42/section-435.552">
                {es ? "Leer la regla federal" : "Read the federal rule"}
              </a>
            </p>
            <ResultMath math={result.math} spanish={es} />
          </details>
          <p>
            {es
              ? "No se guardó nada. Tu estado toma la decisión real."
              : "Nothing was saved. Your state makes the real decision."}
          </p>
          <div className="actions">
            <a href={languageLink("/check", lang)}>
              {es
                ? "Revisar si la regla me aplica"
                : "Check if the rule applies"}
            </a>
            <a href={languageLink("/share", lang)}>
              {es ? "Compartir Eighty" : "Share Eighty"}
            </a>
          </div>
        </section>
      )}
    </>
  );
}
