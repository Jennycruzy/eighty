import { useLocation } from "react-router";

import proof from "../../data/proof.json";
import en from "../../locales/en-US.json";
import es from "../../locales/es-US.json";
import { Landing } from "../components/Landing";
import { useLanguage, languageLink } from "../lib/language";
export default function PublicPage() {
  const lang = useLanguage(),
    spanish = lang === "es";
  const path = useLocation().pathname;
  const link = (path: string) => languageLink(path, lang);
  if (path === "/") return <Landing />;
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
          <h2>
            {spanish
              ? "Lectura de documentos de práctica"
              : "Practice document reading"}
          </h2>
          <p>
            {spanish
              ? "El conjunto sintético tiene 51 documentos: 25 de práctica, usados para ajustar el lector, y 26 reservados que el lector nunca vio mientras se construía."
              : "The synthetic set has 51 documents: 25 practice documents, used to tune the reader, and 26 held-out documents the reader never saw while it was built."}
          </p>
          <p>
            {spanish
              ? "Documentos reservados, que nunca se usaron para ajustar el lector, leídos tres veces: 797 de 822 campos correctos (97.0%), 0 valores equivocados, 77 de 78 meses correctos y 0 meses marcados Meets por error. El único mes fallido es un talón con una instrucción escondida para el modelo: el lector se negó a leerlo y mostró «Aún no sabemos»."
              : "Held-out documents, never used to tune the reader, read three times: 797 of 822 fields right (97.0%), 0 wrong values, 77 of 78 months right and 0 months wrongly marked Meets. The one month missed is a pay stub hiding an instruction aimed at the model: the reader refused it and showed “Not sure yet”."}
          </p>
          <p>
            {spanish
              ? "Documentos de práctica: 267 de 269 campos correctos (99.3%) y 25 de 25 meses correctos en la segunda lectura. Primera lectura: 228 de 269 (84.8%)."
              : "Practice documents: 267 of 269 fields right (99.3%) and 25 of 25 months right on the second read. First read: 228 of 269 (84.8%)."}
          </p>
          <p>
            {spanish
              ? "Entre lecturas, cambiaron las instrucciones para los datos escolares, el contacto del voluntariado y el pago de trabajo por cuenta propia."
              : "Between reads, the instructions changed for school facts, volunteer contacts and gig pay."}
          </p>
          <p>
            <a href="https://github.com/Jennycruzy/eighty/blob/main/docs/tests/results/reading.md">
              {spanish
                ? "Resultados y archivos de las lecturas"
                : "Reading results and files"}
            </a>
          </p>
          <p>
            <a href="https://github.com/Jennycruzy/eighty/tree/main/tests/reading/documents">
              {spanish ? "Documentos" : "Documents"}
            </a>
            {" · "}
            <a href="https://github.com/Jennycruzy/eighty/tree/main/tests/reading/answers">
              {spanish ? "Respuestas" : "Answer files"}
            </a>
          </p>
        </section>
      </>
    );
  const key = path.slice(1) as Exclude<
    keyof typeof en,
    "screener" | "reader" | "example" | "months"
  >;
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
