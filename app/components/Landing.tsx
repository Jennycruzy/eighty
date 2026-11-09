import { useState } from "react";

import proof from "../../data/proof.json";
import { MARIA } from "../../server/lib/example-people";
import {
  REQUIRED_HOURS,
  REQUIRED_INCOME_CENTS,
  FEDERAL_WAGE,
} from "../../server/rules/constants";
import { BOT_TEXT, lineText } from "../../shared/telegram-words";
import { ExampleStart } from "./example/ExampleStart";
import { Rings } from "./Rings";
import { languageLink, useLanguage } from "../lib/language";

const money = (cents: number, es: boolean) =>
  new Intl.NumberFormat(es ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

/** Drag hours and pay; the rings and the answer follow the rule's numbers. */
function HeroTry({ es }: { es: boolean }) {
  const [hours, setHours] = useState(61);
  const [payCents, setPayCents] = useState(0);
  const meets = hours >= REQUIRED_HOURS || payCents >= REQUIRED_INCOME_CENTS;
  const hoursShort = Math.max(0, REQUIRED_HOURS - hours);
  const payShort = Math.max(0, REQUIRED_INCOME_CENTS - payCents);
  return (
    <section className="hero-try" aria-labelledby="hero-try-title">
      <h2 id="hero-try-title" className="sr-only">
        {es ? "Prueba los números" : "Try the numbers"}
      </h2>
      <Rings
        title={es ? "Tu mes" : "Your month"}
        values={{ hours, amountCents: payCents }}
      />
      <label>
        <span>
          {es
            ? "Horas de trabajo, estudio o voluntariado"
            : "Hours of work, school or volunteering"}
        </span>
        <output className="num">{hours}</output>
        <input
          type="range"
          min={0}
          max={120}
          step={1}
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
        />
      </label>
      <label className="pay-range">
        <span>{es ? "Pago del mes" : "Pay this month"}</span>
        <output className="num">{money(payCents, es)}</output>
        <input
          type="range"
          min={0}
          max={100_000}
          step={500}
          value={payCents}
          onChange={(event) => setPayCents(Number(event.target.value))}
        />
      </label>
      <p className="verdict" role="status" aria-live="polite">
        {meets
          ? es
            ? "Eso cumple los números de la regla."
            : "That meets the rule's numbers."
          : es
            ? `Faltan ${hoursShort} horas, o ${money(payShort, es)} más de pago.`
            : `${hoursShort} hours short, or ${money(payShort, es)} more pay.`}
        <small className="muted">
          {es
            ? "Solo los números. Las exenciones y tu estado pueden cambiar la respuesta. No se guarda nada."
            : "Numbers only. Exemptions and your state can change the answer. Nothing is saved."}
        </small>
      </p>
    </section>
  );
}

export function Landing() {
  const lang = useLanguage();
  const es = lang === "es";
  const link = (path: string) => languageLink(path, lang);
  const words = BOT_TEXT[es ? "es" : "en"];
  const mariaLine = lineText(
    {
      kind: "income",
      organization: MARIA.delivery,
      income: { grossPayCents: MARIA.sample.totalCents },
    },
    es ? "es" : "en",
  );
  return (
    <div className="landing">
      <section className="hero" aria-labelledby="hero-title">
        <div>
          <h1 id="hero-title">
            {es ? (
              <>
                <span className="hours-word">80 horas</span> o{" "}
                <span className="pay-word">
                  {money(REQUIRED_INCOME_CENTS, true)}
                </span>
                . Cada mes.
              </>
            ) : (
              <>
                <span className="hours-word">80 hours</span> or{" "}
                <span className="pay-word">
                  {money(REQUIRED_INCOME_CENTS, false)}
                </span>
                . Every month.
              </>
            )}
          </h1>
          <p className="intro">
            {es
              ? "La nueva regla federal de trabajo pide a muchos adultos con Medicaid mostrar trabajo, estudios, voluntariado o pago cada mes. Eighty guarda tus pruebas, las lee y te muestra cómo va tu mes."
              : "The new federal work rule asks many adults on Medicaid to show work, school, volunteering or pay each month. Eighty keeps your proof, reads it, and shows where your month stands."}
          </p>
          <div className="actions">
            <a className="button" href={link("/check")}>
              {es ? "Revisar si me aplica" : "Check if it applies to me"}
            </a>
            <a className="button secondary" href={link("/try")}>
              {es ? "Probar con mi mes" : "Try your own month"}
            </a>
          </div>
        </div>
        <HeroTry es={es} />
      </section>

      <section className="band" aria-labelledby="phone-title">
        <div className="split">
          <div>
            <h2 id="phone-title">
              {es
                ? "Envía pruebas como envías un mensaje."
                : "Send proof the way you send a text."}
            </h2>
            <p className="intro">
              {es
                ? "Vincula Telegram una vez. Luego envía una foto de un talón de pago, un PDF o una nota de voz en inglés o español. Eighty lo lee y propone una línea. Nada cuenta hasta que tú lo revises."
                : "Link Telegram once. Then send a photo of a pay stub, a PDF, or a voice note in English or Spanish. Eighty reads it and proposes a line. Nothing counts until you check it."}
            </p>
            <ul className="steps">
              <li>
                <strong>{es ? "Foto o voz" : "Snap or speak"}</strong>
                <span>
                  {es
                    ? "Un talón, una hoja de horas, una carta del voluntariado, o di tus horas en voz alta."
                    : "A pay stub, a timesheet, a volunteer letter, or say your hours out loud."}
                </span>
              </li>
              <li>
                <strong>{es ? "Eighty lo lee" : "Eighty reads it"}</strong>
                <span>
                  {es
                    ? "Fechas, horas y pago, guardados cifrados en tu cuenta."
                    : "Dates, hours and pay, kept encrypted in your account."}
                </span>
              </li>
              <li>
                <strong>{es ? "Tú lo revisas" : "You check it"}</strong>
                <span>
                  {es
                    ? "El anillo se llena solo cuando confirmas."
                    : "The ring fills only when you confirm."}
                </span>
              </li>
            </ul>
          </div>
          <figure className="phone-figure">
            <div className="phone" aria-hidden="true">
              <p className="chat-title">Eighty · @TryEightybot</p>
              <div className="bubble me photo-bubble">
                <img
                  src="/example/maria-earnings-sample.png"
                  alt=""
                  width="240"
                  height="160"
                  loading="lazy"
                />
              </div>
              <div className="bubble bot">
                {`${words.read(1)}\n• ${mariaLine}\n${words.check}: tryeighty.space/review`}
              </div>
            </div>
            <figcaption className="note">
              {es
                ? "El ejemplo de María (inventado). Así responde el bot cuando lee su resumen de ganancias."
                : "Maria's example (made up). This is how the bot answers when it reads her earnings summary."}
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="band" aria-labelledby="rule-title">
        <h2 id="rule-title">
          {es ? "La regla, en palabras simples." : "The rule, in plain words."}
        </h2>
        <p className="intro">
          {es
            ? "Una de estas dos cosas cada mes, a menos que la regla no te aplique."
            : "One of these two each month, unless the rule doesn't apply to you."}
        </p>
        <div className="rule-pair">
          <div className="hours">
            <span className="big num">{REQUIRED_HOURS}</span>
            <h3>{es ? "horas" : "hours"}</h3>
            <p>
              {es
                ? "De trabajo, voluntariado, estudios o un programa de trabajo. Se suman."
                : "Of work, volunteering, school or a work program. They add up."}
            </p>
          </div>
          <div className="pay">
            <span className="big num">
              {money(REQUIRED_INCOME_CENTS, es)}
            </span>
            <h3>{es ? "de pago" : "in pay"}</h3>
            <p>
              {es
                ? `O ganar lo de ${REQUIRED_HOURS} horas al salario mínimo federal de ${money(FEDERAL_WAGE.cents, true)}.`
                : `Or earn what ${REQUIRED_HOURS} hours pay at the ${money(FEDERAL_WAGE.cents, false)} federal minimum wage.`}
            </p>
          </div>
          <div className="free">
            <span className="big">{es ? "Exento" : "Exempt"}</span>
            <h3>{es ? "si te aplica" : "if it applies"}</h3>
            <p>
              {es
                ? "Por ejemplo, cuidar a un familiar con discapacidad, estar embarazada o ciertas condiciones de salud. Eighty te pregunta."
                : "For example, caring for a family member with a disability, being pregnant, or certain health conditions. Eighty asks."}
            </p>
          </div>
        </div>
        <p className="note">
          {es ? "La ley: " : "The law: "}
          <a href="https://www.ecfr.gov/current/title-42/section-435.552">
            42 CFR 435.552
          </a>
          {" · "}
          <a href="https://www.ecfr.gov/current/title-42/section-435.554">
            42 CFR 435.554
          </a>
          {". "}
          {es ? "Tu estado decide." : "Your state decides."}
        </p>
      </section>

      <section className="band" aria-labelledby="checked-title">
        <h2 id="checked-title">
          {es ? "Revisado, no adivinado." : "Checked, not guessed."}
        </h2>
        <p className="intro">
          {es
            ? "Las reglas y la lectura de documentos se prueban con respuestas conocidas. Los resultados son públicos."
            : "The rules and the document reading are tested against known answers. The results are public."}
        </p>
        <dl className="figures">
          <div>
            <dt className="num">
              {proof.passed}/{proof.cases}
            </dt>
            <dd>
              {es
                ? "casos citados de la regla federal pasan"
                : "cited federal rule cases pass"}
            </dd>
          </div>
          <div>
            <dt className="num">97%</dt>
            <dd>
              {es
                ? "de los campos leídos bien en 26 documentos reservados, tres lecturas (797 de 822), sin ningún valor equivocado"
                : "of fields read right on 26 held-out documents, three reads (797 of 822), with no wrong values"}
            </dd>
          </div>
          <div>
            <dt className="num">0</dt>
            <dd>
              {es
                ? "meses marcados como que cumplen por error, en 78 meses reservados"
                : "months wrongly marked as meeting the rule, out of 78 held-out months"}
            </dd>
          </div>
        </dl>
        <p>
          <a href={link("/proof")}>
            {es ? "Ver las pruebas y los archivos" : "See the tests and files"}
          </a>
        </p>
      </section>

      <section className="band" aria-labelledby="start-title">
        <h2 id="start-title">
          {es ? "Empieza donde estés." : "Start where you are."}
        </h2>
        <div className="paths">
          <section className="card">
            <h3>{es ? "Tengo Medicaid" : "I’m on Medicaid"}</h3>
            <p>
              {es
                ? "Responde unas preguntas para ver si la regla puede aplicarte."
                : "Answer a few questions to see if the rule may apply to you."}
            </p>
            <a className="button" href={link("/check")}>
              {es ? "Responder las preguntas" : "Answer the questions"}
            </a>
          </section>
          <section className="card">
            <h3>
              {es ? "Prueba con tu propio mes" : "Try it on your own month"}
            </h3>
            <p>
              {es
                ? "Escribe tu pago y tus horas, o sube un talón. No guardamos tus datos."
                : "Type your pay and hours, or read one pay stub. Nothing is saved."}
            </p>
            <a className="button secondary" href={link("/try")}>
              {es ? "Revisar un mes" : "Check a month"}
            </a>
          </section>
          <ExampleStart />
        </div>
        <p className="note">
          <a href={link("/states")}>
            {es ? "Busca tu estado" : "Find your state"}
          </a>
          {" · "}
          <a href={link("/for-navigators")}>
            {es ? "Para navegadores" : "For navigators"}
          </a>
          {" · "}
          <a href={link("/share")}>
            {es ? "Envía Eighty a alguien" : "Send Eighty to someone"}
          </a>
        </p>
      </section>

      <section className="closing" aria-labelledby="closing-title">
        <h2 id="closing-title">
          {es
            ? "Tu estado decide. Llega con tus pruebas listas."
            : "Your state decides. Show up with your proof ready."}
        </h2>
        <p>
          {es
            ? "Guarda cada prueba en un solo lugar, en tu teléfono, en inglés o en español."
            : "Keep every piece of proof in one place, on your phone, in English or Spanish."}
        </p>
        <div className="actions">
          <a className="button" href={link("/check")}>
            {es ? "Empezar" : "Get started"}
          </a>
        </div>
      </section>
    </div>
  );
}
