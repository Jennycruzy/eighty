import { useEffect, useRef, useState } from "react";

import proof from "../../data/proof.json";
import { MARIA } from "../../server/lib/example-people";
import {
  REQUIRED_HOURS,
  REQUIRED_INCOME_CENTS,
  FEDERAL_WAGE,
} from "../../server/rules/constants";
import { BOT_TEXT, STATUS, lineText } from "../../shared/telegram-words";
import { ExampleStart } from "./example/ExampleStart";
import { languageLink, useLanguage } from "../lib/language";

const money = (cents: number, es: boolean) =>
  new Intl.NumberFormat(es ? "es-US" : "en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

/** Sections fade up once as they enter the screen. Off with reduced motion (CSS). */
function useReveal() {
  useEffect(() => {
    const items = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (!("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-in"));
      return;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            seen.unobserve(entry.target);
          }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    items.forEach((item) => seen.observe(item));
    return () => seen.disconnect();
  }, []);
}

/** A number that counts up once it is on screen. */
function Count({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setValue(0);
    const seen = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      seen.disconnect();
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / 1100);
        setValue(Math.round(to * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    seen.observe(node);
    return () => seen.disconnect();
  }, [to]);
  return (
    <span ref={ref} className="num">
      {value.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}

/**
 * The hero plays Maria's month in about five seconds: her voice note arrives,
 * she confirms it and the hours ring grows 61 -> 65, Do my month counts her
 * pay after costs, and the month changes to Meets the rule. The figures are
 * her example record's own numbers. With reduced motion it shows the end.
 */
const STORY_STEPS = [0, 900, 2100, 3300, 4700] as const;

function useStory() {
  const ref = useRef<HTMLElement>(null);
  const [step, setStep] = useState(-1);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(STORY_STEPS.length - 1);
      return;
    }
    setStep(-1);
    let timers: number[] = [];
    const play = () => {
      timers = STORY_STEPS.map((at, i) => window.setTimeout(() => setStep(i), at + 60));
    };
    const node = ref.current;
    if (!node || !("IntersectionObserver" in window)) {
      play();
      return () => timers.forEach((t) => window.clearTimeout(t));
    }
    // Starts when the rings are on screen, so a phone visitor sees it too.
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        seen.disconnect();
        play();
      },
      { threshold: 0.45 },
    );
    seen.observe(node);
    return () => {
      seen.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [run]);
  return { ref, step, replay: () => setRun((n) => n + 1) };
}

/** A figure that glides to its new value. */
function useGlide(to: number, ms = 900) {
  const [value, setValue] = useState(to);
  const from = useRef(to);
  useEffect(() => {
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const next = begin + (to - begin) * (1 - Math.pow(1 - t, 3));
      from.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, ms]);
  return value;
}

function HeroStory({ es }: { es: boolean }) {
  const { ref, step, replay } = useStory();
  const before = MARIA.deliveryHours + MARIA.pantryHours;
  const added = 4;
  const payAfterCosts = MARIA.sample.totalCents - MARIA.sample.costsCents;
  const hoursNow = step < 0 ? 0 : step >= 2 ? before + added : before;
  const payNow = step >= 3 ? payAfterCosts : 0;
  const meets = step >= 4;
  const hours = useGlide(hoursNow);
  const pay = useGlide(payNow);
  const ring = (r: number, share: number, kind: "hours" | "pay") => {
    const c = 2 * Math.PI * r;
    return (
      <>
        <circle className={`lx-track ${kind}`} cx="120" cy="120" r={r} />
        <circle
          className={`lx-arc ${kind}`}
          cx="120"
          cy="120"
          r={r}
          style={{
            strokeDasharray: `${c}`,
            strokeDashoffset: `${c * (1 - Math.min(1, Math.max(0, share)))}`,
            opacity: share > 0 ? 1 : 0,
          }}
        />
      </>
    );
  };
  const notes = es
    ? [
        "María manda una nota de voz",
        "Eighty la escucha y propone la línea",
        `Ella la confirma: +${added} horas`,
        "Haz mi mes: su pago después de gasolina y teléfono",
        "Noviembre cumple la regla",
      ]
    : [
        "Maria sends a voice note",
        "Eighty hears it and proposes the line",
        `She confirms it: +${added} hours`,
        "Do my month: her pay after gas and phone",
        "November meets the rule",
      ];
  const words = BOT_TEXT[es ? "es" : "en"];
  const said = es
    ? "Trabajé cuatro horas en la despensa el sábado."
    : "I volunteered 4 hours at the pantry on Saturday.";
  const line = lineText(
    { kind: "service", organization: MARIA.pantry, hours: added },
    es ? "es" : "en",
  );
  const status = STATUS[es ? "es" : "en"][meets ? "Meets" : "Not sure yet"];
  return (
    <>
      <p className="lx-story-note" aria-live="polite">
        <span key={step}>{notes[Math.max(0, step)]}</span>
        {meets ? (
          <button type="button" className="lx-replay" onClick={replay}>
            {es ? "Otra vez" : "Replay"}
          </button>
        ) : null}
      </p>
      <figure
        ref={ref}
        className={`lx-rings${meets ? " is-met" : ""}`}
        aria-label={es ? "El mes de María" : "Maria's month"}
      >
        <svg viewBox="0 0 240 240" role="img" aria-hidden="true">
          <g transform="rotate(-90 120 120)">
            {ring(96, hours / REQUIRED_HOURS, "hours")}
            {ring(64, pay / REQUIRED_INCOME_CENTS, "pay")}
          </g>
        </svg>
        <figcaption>
          <span className="lx-who">{es ? "María · noviembre" : "Maria · November"}</span>
          <span className="lx-figs">
            <span className="hours num">
              {Math.round(hours)}
              <small>/{REQUIRED_HOURS} h</small>
              {step === 2 || step === 3 ? <em className="lx-plus">+{added} h</em> : null}
            </span>
            <span className="pay num">
              {money(Math.round(pay), es)}
              <small>/{money(REQUIRED_INCOME_CENTS, es)}</small>
            </span>
          </span>
          <span className={`lx-meets${meets ? " on" : ""}`}>{status}</span>
        </figcaption>
      </figure>
      <div className="lx-phone" aria-hidden="true">
        <div className="lx-phone-top">
          <span className="lx-avatar">8</span>
          <span>
            <strong>Eighty</strong>
            <small>@TryEightybot</small>
          </span>
        </div>
        <div className={`lx-msg me${step >= 0 ? " shown" : ""}`}>
          <span className="lx-play" />
          <span className="lx-wave">
            {Array.from({ length: 22 }, (_, i) => (
              <i key={i} style={{ height: `${6 + ((i * 37) % 17)}px`, animationDelay: `${i * 40}ms` }} />
            ))}
          </span>
          <small>0:04</small>
        </div>
        <div className={`lx-msg bot${step >= 1 ? " shown" : ""}`}>
          {words.heard(said)}
          {"\n• "}
          {line}
          {"\n"}
          {words.check}
        </div>
      </div>
    </>
  );
}

export function Landing() {
  const lang = useLanguage();
  const es = lang === "es";
  const link = (path: string) => languageLink(path, lang);
  useReveal();
  const pay = money(REQUIRED_INCOME_CENTS, es);
  return (
    <div className="lx">
      <section className="lx-hero" aria-labelledby="hero-title">
        <div className="lx-hero-copy">
          <h1 id="hero-title">
            {es ? (
              <>
                Conserva tu Medicaid. <span>Eighty hace el papeleo.</span>
              </>
            ) : (
              <>
                Keep your Medicaid. <span>Eighty does the paperwork.</span>
              </>
            )}
          </h1>
          <p className="lx-lede">
            {es
              ? `La nueva regla federal pide ${REQUIRED_HOURS} horas o ${pay} cada mes. Manda tus pruebas desde el teléfono, en inglés o en español. Eighty las lee, planea lo que falta y arma el paquete. Tú solo confirmas.`
              : `The new federal rule asks for ${REQUIRED_HOURS} hours or ${pay} every month. Send your proof from your phone, in English or Spanish. Eighty reads it, plans what's missing and makes the packet. You only confirm.`}
          </p>
          <div className="lx-actions">
            <ExampleStart variant="hero" />
            <a className="button secondary" href={link("/check")}>
              {es ? "Revisar si me aplica" : "Check if it applies to me"}
            </a>
          </div>
        </div>
        <div className="lx-hero-art">
          <HeroStory es={es} />
        </div>
      </section>

      <section className="lx-stakes" data-reveal aria-label={es ? "Por qué importa" : "Why it matters"}>
        <p className="lx-stakes-line">
          {es ? (
            <>
              En 2018, Arkansas sacó de Medicaid a unas <em>18,000 personas</em>. La mayoría cumplía. Lo perdieron por el papeleo.
            </>
          ) : (
            <>
              In 2018, Arkansas cut about <em>18,000 people</em> from Medicaid. Most of them qualified. They lost it to paperwork.
            </>
          )}
        </p>
        <p className="lx-source">
          {es
            ? "Más del 40% no logró reportar; cerca del 6% no habría cumplido. La regla federal empieza el 31 de diciembre de 2026. "
            : "Over 40% failed to report; about 6% would not have met the rule. The federal rule starts on 31 December 2026. "}
          <a href="https://www.kff.org/medicaid/issue-brief/an-early-look-at-implementation-of-medicaid-work-requirements-in-arkansas/">KFF</a>
          {" · "}
          <a href="https://www.cbpp.org/research/health/pain-but-no-gain-arkansas-failed-medicaid-work-reporting-requirements-should-not-be">CBPP</a>
        </p>
      </section>

      <section className="lx-band" aria-labelledby="how-title">
        <h2 id="how-title" data-reveal>
          {es ? "Así se completa un mes." : "How a month gets done."}
        </h2>
        <ol className="lx-steps">
          <li data-reveal>
            <span className="lx-step-n num">1</span>
            <h3>{es ? "Dilo o mándalo." : "Say it or send it."}</h3>
            <p>
              {es
                ? "Una nota de voz, la foto de un talón o un PDF por Telegram. En inglés o en español."
                : "A voice note, a photo of a pay stub or a PDF, on Telegram. In English or Spanish."}
            </p>
          </li>
          <li data-reveal>
            <span className="lx-step-n num">2</span>
            <h3>{es ? "Eighty hace el papeleo." : "Eighty does the paperwork."}</h3>
            <p>
              {es
                ? "Lee cada archivo, encuentra lo que falta, hace la única pregunta que necesita y arma un plan que las reglas aceptan."
                : "It reads each file, finds the gap, asks the one question it needs and lays out a plan the rules accept."}
            </p>
          </li>
          <li data-reveal>
            <span className="lx-step-n num">3</span>
            <h3>{es ? "Tú confirmas." : "You confirm."}</h3>
            <p>
              {es
                ? "Nada cuenta hasta que tú lo tocas. Cuando el mes cumple, tu paquete en PDF está listo para enviar."
                : "Nothing counts until you tap it. When the month meets the rule, your PDF packet is ready to send."}
            </p>
          </li>
        </ol>
      </section>

      <section className="lx-band lx-rule" aria-labelledby="rule-title">
        <h2 id="rule-title" data-reveal>
          {es ? "La regla, en palabras simples." : "The rule, in plain words."}
        </h2>
        <div className="lx-rule-row">
          <div className="hours" data-reveal>
            <span className="lx-big num">{REQUIRED_HOURS}</span>
            <h3>{es ? "horas al mes" : "hours a month"}</h3>
            <p>
              {es
                ? "De trabajo, voluntariado, estudios o un programa de trabajo. Se suman."
                : "Of work, volunteering, school or a work program. They add up."}
            </p>
          </div>
          <div className="pay" data-reveal>
            <span className="lx-big num">{pay}</span>
            <h3>{es ? "o de pago" : "or in pay"}</h3>
            <p>
              {es
                ? `Lo que pagan ${REQUIRED_HOURS} horas al salario mínimo federal de ${money(FEDERAL_WAGE.cents, true)}.`
                : `What ${REQUIRED_HOURS} hours pay at the ${money(FEDERAL_WAGE.cents, false)} federal minimum wage.`}
            </p>
          </div>
          <div className="free" data-reveal>
            <span className="lx-big">{es ? "Exento" : "Exempt"}</span>
            <h3>{es ? "si te aplica" : "if it applies"}</h3>
            <p>
              {es
                ? "Por ejemplo, cuidar a un familiar con discapacidad, un embarazo o ciertas condiciones de salud. Eighty pregunta."
                : "For example, caring for a family member with a disability, pregnancy, or certain health conditions. Eighty asks."}
            </p>
          </div>
        </div>
        <p className="lx-source" data-reveal>
          {es ? "La ley: " : "The law: "}
          <a href="https://www.ecfr.gov/current/title-42/section-435.552">42 CFR 435.552</a>
          {" · "}
          <a href="https://www.ecfr.gov/current/title-42/section-435.554">42 CFR 435.554</a>
          {es ? ". Tu estado decide." : ". Your state decides."}
        </p>
      </section>

      <section className="lx-band" aria-labelledby="checked-title">
        <h2 id="checked-title" data-reveal>
          {es ? "Medido, no adivinado." : "Measured, not guessed."}
        </h2>
        <dl className="lx-figures">
          <div data-reveal>
            <dt>
              <Count to={797} />
              <small className="num">/822</small>
            </dt>
            <dd>
              {es
                ? "campos leídos bien en 26 documentos reservados, sin ningún valor equivocado"
                : "fields read right on 26 held-out documents, with no wrong values"}
            </dd>
          </div>
          <div data-reveal>
            <dt>
              <Count to={proof.passed} />
              <small className="num">/{proof.cases}</small>
            </dt>
            <dd>{es ? "casos citados de la regla federal pasan" : "cited federal rule cases pass"}</dd>
          </div>
          <div data-reveal>
            <dt>
              <Count to={0} />
            </dt>
            <dd>
              {es
                ? "meses marcados como que cumplen por error, de 78 reservados"
                : "months wrongly marked as meeting the rule, of 78 held out"}
            </dd>
          </div>
        </dl>
        <p className="lx-source" data-reveal>
          <a href={link("/proof")}>{es ? "Ver las pruebas y los archivos" : "See the tests and files"}</a>
        </p>
      </section>

      <section className="lx-close" data-reveal aria-labelledby="closing-title">
        <h2 id="closing-title">
          {es ? "Tu estado decide. Llega con tus pruebas listas." : "Your state decides. Show up with your proof ready."}
        </h2>
        <div className="lx-actions">
          <a className="button" href={link("/check")}>
            {es ? "Empezar con mi mes" : "Start with my month"}
          </a>
        </div>
        <p className="lx-source">
          <a href={link("/try")}>{es ? "Revisar un mes" : "Check a month"}</a>
          {" · "}
          <a href={link("/states")}>{es ? "Busca tu estado" : "Find your state"}</a>
          {" · "}
          <a href={link("/for-navigators")}>{es ? "Para navegadores" : "For navigators"}</a>
          {" · "}
          <a href={link("/share")}>{es ? "Envía Eighty a alguien" : "Send Eighty to someone"}</a>
        </p>
      </section>
    </div>
  );
}
