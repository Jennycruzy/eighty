import { useLocation } from "react-router";

import proof from "../../data/proof.json";
import en from "../../locales/en-US.json";
import es from "../../locales/es-US.json";
import { DemoStart } from "../components/demo/DemoStart";
import { useLanguage, languageLink } from "../lib/language";
export default function PublicPage() {
  const lang = useLanguage(),
    spanish = lang === "es";
  const path = useLocation().pathname;
  const link = (path: string) => languageLink(path, lang);
  if (path === "/")
    return (
      <>
        <p className="eyebrow">
          {spanish
            ? "Medicaid · Tus pruebas, claras"
            : "Medicaid · Your proof, made clear"}
        </p>
        <h1>
          {spanish
            ? "Entiende la regla. Guarda tu cobertura."
            : "Understand the rule. Keep your coverage."}
        </h1>
        <p className="intro">
          {spanish
            ? "Revisa qué pide la regla federal de 80 horas y qué pruebas puedes guardar. Sin cuenta."
            : "Check what the federal 80-hour rule asks for and what proof to keep. No account needed."}
        </p>
        <div className="cards">
          <section className="card">
            <h2>{spanish ? "Tengo Medicaid" : "I’m on Medicaid"}</h2>
            <p>
              {spanish
                ? "Responde unas preguntas para ver si la regla puede aplicarte."
                : "Answer a few questions to see if the rule may apply to you."}
            </p>
            <a className="button" href={link("/check")}>
              {spanish ? "Revisar si me aplica" : "Check if it applies to me"}
            </a>
          </section>
          <section className="card">
            <h2>
              {spanish
                ? "Prueba con tu propio mes"
                : "Try it on your own month"}
            </h2>
            <p>
              {spanish
                ? "Escribe tu pago y tus horas. Mira qué dice la regla. No guardamos tus datos."
                : "Type your pay and hours. See how the rule reads them. Nothing is saved."}
            </p>
            <a className="button secondary" href={link("/try")}>
              {spanish ? "Revisar un mes" : "Check a month"}
            </a>
          </section>
        </div>
        <DemoStart />
        <p>
          {spanish
            ? "Conoce la regla. Revisa tus datos. Guarda tus pruebas."
            : "Learn the rule. Check your facts. Keep your proof."}
        </p>
        <p>
          <a href={link("/states")}>
            {spanish ? "Busca tu estado" : "Find your state"}
          </a>{" "}
          ·{" "}
          <a href={link("/share")}>
            {spanish ? "Envía Eighty a alguien" : "Send Eighty to someone"}
          </a>
        </p>
        <details>
          <summary>
            {spanish
              ? "Hecho con la regla federal, 42 CFR 435"
              : "Built from the federal rule, 42 CFR 435"}
          </summary>
          <a href="https://www.ecfr.gov/current/title-42/section-435.552">
            42 CFR 435.552
          </a>
        </details>
      </>
    );
  if (path === "/proof")
    return (
      <>
        <h1>
          {spanish ? "Pruebas que puedes revisar" : "Proof you can check"}
        </h1>
        <p>
          {spanish
            ? "Publicamos los resultados reales. Las pruebas con datos de ejemplo no son pruebas con miembros."
            : "We publish the actual results. Made-up test cases are not tests with real people."}
        </p>
        <section className="card">
          <h2>{spanish ? "Reglas federales" : "Federal rules"}</h2>
          <p>
            {proof.passed} / {proof.cases}{" "}
            {spanish ? "casos citados pasaron" : "cited cases passed"}.
          </p>
          <p>
            {spanish ? "Versión" : "Version"}: {proof.ruleVersion}.{" "}
            {spanish ? "Revisado" : "Checked"}: {proof.checkedOn}.
          </p>
          <p>
            <a href="/proof/answer-key.md">
              {spanish
                ? "Leer los casos y resultados"
                : "Read the cases and results"}
            </a>
          </p>
          <p>
            <a href="/proof/answer-cases.json">
              {spanish
                ? "Descargar las entradas y respuestas esperadas"
                : "Download the inputs and expected answers"}
            </a>
          </p>
          <p>
            {spanish
              ? "Aún falta una revisión legal por otra persona. No se han publicado pruebas de lectura de documentos ni de uso con miembros."
              : "Independent legal review is still needed. Document-reading and member usability results have not been published."}
          </p>
        </section>
      </>
    );
  const key = path.slice(1) as Exclude<keyof typeof en, "screener" | "reader" | "demo">;
  const content = (spanish ? es : en)[key];
  return (
    <>
      <h1>{content.title}</h1>
      <p className="intro">{content.intro}</p>
      {content.sections.map(([title, text]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      {path === "/help" && (
        <p>
          <a href="tel:211">211</a> ·{" "}
          <a href="https://localhelp.healthcare.gov/">
            {spanish ? "Buscar ayuda oficial" : "Find official help"}
          </a>{" "}
          · <a href={link("/states")}>{spanish ? "Tu estado" : "Your state"}</a>
        </p>
      )}
      {path === "/how-it-works" && (
        <details>
          <summary>{spanish ? "Ver la ley" : "Read the law"}</summary>
          <a href="https://www.ecfr.gov/current/title-42/section-435.552">
            42 CFR 435.552
          </a>
          <p>
            <a href={link("/proof")}>
              {spanish ? "Ver las pruebas" : "See the tests"}
            </a>
          </p>
        </details>
      )}
    </>
  );
}
