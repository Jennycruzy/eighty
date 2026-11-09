import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useRef, useState } from "react";

import { useLanguage } from "../lib/language";

interface LinkState {
  available: boolean;
  bot: string | null;
  linked: boolean;
  code: string | null;
  url: string | null;
  expiresAt?: string;
  language?: "en-US" | "es-US";
}

const COPY = {
  en: {
    title: "Send proof from your phone",
    intro:
      "Link Telegram once. Then send a photo or PDF of a pay stub, or a voice note about your hours. It shows up here for you to check.",
    link: "Link Telegram",
    working: "Making a code…",
    open: "Open Telegram",
    or: (bot: string) => `Or send this code to @${bot}:`,
    expires: "The code works once, for 15 minutes.",
    waiting: "Waiting for your message in Telegram…",
    linked: "Telegram is linked. Send a photo, a PDF or a voice note.",
    tryIt: 'Try a voice note: "I volunteered 4 hours at the pantry on Saturday."',
    unlink: "Unlink Telegram",
    error: "That didn't work. Try again.",
    off: "Telegram linking is switched off on this site.",
    replies: "The bot hears and answers in:",
  },
  es: {
    title: "Envía pruebas desde tu teléfono",
    intro:
      "Vincula Telegram una vez. Luego envía una foto o un PDF de un talón de pago, o una nota de voz sobre tus horas. Aparece aquí para que lo revises.",
    link: "Vincular Telegram",
    working: "Creando un código…",
    open: "Abrir Telegram",
    or: (bot: string) => `O envía este código a @${bot}:`,
    expires: "El código sirve una vez, durante 15 minutos.",
    waiting: "Esperando tu mensaje en Telegram…",
    linked: "Telegram está vinculado. Envía una foto, un PDF o una nota de voz.",
    tryIt:
      'Prueba una nota de voz: "Trabajé cuatro horas en la despensa el sábado."',
    unlink: "Desvincular Telegram",
    error: "No funcionó. Inténtalo otra vez.",
    off: "La vinculación con Telegram está apagada en este sitio.",
    replies: "El bot escucha y responde en:",
  },
};

const call = (
  op: "status" | "code" | "unlink" | "language",
  language?: "en-US" | "es-US",
) =>
  callAction(
    "telegram_link",
    language ? { op, language } : { op },
    { method: "POST", uiOnly: true },
  ) as Promise<LinkState>;

/** Links the member's Telegram from their own signed-in page. */
export function TelegramLink({ onLinked }: { onLinked?: () => void }) {
  const lang = useLanguage();
  const copy = COPY[lang === "es" ? "es" : "en"];
  const [state, setState] = useState<LinkState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const wasLinked = useRef(false);

  useEffect(() => {
    let active = true;
    call("status")
      .then((result) => {
        if (!active) return;
        wasLinked.current = result.linked;
        setState(result);
      })
      .catch(() => {
        /* Without the status, the rest of the page still works. */
      });
    return () => {
      active = false;
    };
  }, []);

  // While a code is on screen, check every few seconds for the link.
  useEffect(() => {
    if (!state?.code || state.linked) return;
    const timer = window.setInterval(() => {
      call("status")
        .then((result) => {
          if (!result.linked) return;
          wasLinked.current = true;
          setState(result);
          onLinked?.();
        })
        .catch(() => {});
    }, 3000);
    return () => window.clearInterval(timer);
  }, [state?.code, state?.linked, onLinked]);

  if (!state) return null;
  if (!state.available)
    return (
      <section className="card telegram-link" aria-labelledby="telegram-title">
        <h2 id="telegram-title">{copy.title}</h2>
        <p>{copy.off}</p>
      </section>
    );

  const act = async (
    op: "code" | "unlink" | "language",
    language?: "en-US" | "es-US",
  ) => {
    setBusy(true);
    setError(false);
    try {
      setState(await call(op, language));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card telegram-link" aria-labelledby="telegram-title">
      <h2 id="telegram-title">{copy.title}</h2>
      <div className="lang-switch" role="group" aria-label={copy.replies}>
        <span>{copy.replies}</span>
        {(
          [
            ["en-US", "English"],
            ["es-US", "Español"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={state.language === value ? "on" : "secondary"}
            aria-pressed={state.language === value}
            disabled={busy}
            onClick={() => void act("language", value)}
          >
            {label}
          </button>
        ))}
      </div>
      {state.linked ? (
        <>
          <p role="status">
            <span className="linked-dot" aria-hidden="true" />
            {copy.linked}
          </p>
          <p className="note">{copy.tryIt}</p>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void act("unlink")}
          >
            {copy.unlink}
          </button>
        </>
      ) : state.code && state.url ? (
        <>
          <p>
            <a
              className="button"
              href={state.url}
              target="_blank"
              rel="noreferrer"
            >
              {copy.open}
            </a>
          </p>
          <p>{copy.or(state.bot ?? "")}</p>
          <p className="telegram-code" aria-label={state.code.split("").join(" ")}>
            {state.code}
          </p>
          <p className="note">{copy.expires}</p>
          <p role="status" aria-live="polite">
            {copy.waiting}
          </p>
        </>
      ) : (
        <>
          <p>{copy.intro}</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("code")}
          >
            {busy ? copy.working : copy.link}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="error">
          {copy.error}
        </p>
      )}
    </section>
  );
}
