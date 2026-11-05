import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { Link, useLoaderData } from "react-router";

import { coverageAnswers, visibleQuestions } from "../../shared/screener";
import en from "../../locales/en-US.json";
import esCopy from "../../locales/es-US.json";
import { useLanguage, languageLink } from "../lib/language";
import { useScreenerDraft } from "../lib/screener-draft";
export function headers() {
  return { "x-agent-native-ssr-max-age": "0" };
}
export async function loader() {
  const { registrationStatus } = await import("../../server/lib/registration");
  return registrationStatus();
}
export default function Account() {
  const { open } = useLoaderData<typeof loader>();
  const lang = useLanguage(),
    es = lang === "es";
  const { answers, setAnswers } = useScreenerDraft();
  const copy = (es ? esCopy : en).screener;
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [sent, setSent] = useState(false),
    [verified, setVerified] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/_agent-native/auth/ba/get-session", { cache: "no-store" })
      .then((r) => r.json())
      .then(async (session) => {
        if (!active || session?.user?.emailVerified !== true) return;
        const draft = new URL(window.location.href).searchParams.get("draft");
        if (draft) {
          setBusy(true);
          try {
            const result = await callAction(
              "finish_member_account",
              { draft },
              { method: "POST", uiOnly: true },
            );
            if (active) {
              setSaved(result.saved);
              setVerified(true);
              setAnswers({});
              const url = new URL(window.location.href);
              url.searchParams.delete("draft");
              window.history.replaceState(null, "", url);
            }
          } catch {
            if (active) setError(true);
          } finally {
            if (active) setBusy(false);
          }
        } else setVerified(true);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [open]);
  const hasAnswers = Object.keys(answers).length > 0;
  return (
    <>
      <p>
        <Link to={languageLink("/check/sign-in", lang)}>
          {es ? "Ya tengo una cuenta: entrar" : "I have an account: sign in"}
        </Link>
      </p>
      <h1>{es ? "Seguir mis meses" : "Track my months"}</h1>
      {!open ? (
        <section className="card">
          <h2>
            {es
              ? "Aún no puedes crear una cuenta"
              : "Account creation is closed"}
          </h2>
          <p>
            {es
              ? "Estamos configurando el correo en el dominio real de Eighty. No se envió nada. Tus respuestas siguen solo en esta página."
              : "Email is being set up on Eighty’s real domain. Nothing was sent. Your answers are still only in this page."}
          </p>
        </section>
      ) : verified ? (
        <section className="result" role="status">
          <h2>{es ? "Tu correo está verificado" : "Your email is verified"}</h2>
          <p>
            {saved
              ? es
                ? "Guardamos tus respuestas en tu cuenta."
                : "Your answers are saved in your account."
              : es
                ? "Se conservan las respuestas que ya tiene tu cuenta."
                : "Your account’s existing answers are kept."}
          </p>
        </section>
      ) : sent ? (
        <section className="result" role="status">
          <h2>{es ? "Revisa tu correo" : "Check your email"}</h2>
          <p>
            {es
              ? "Abre el enlace para verificar tu correo y guardar tus respuestas. Si ya tienes una cuenta, usa tu forma habitual de entrar."
              : "Open the link to verify your email and save your answers. If you already have an account, use your usual way to sign in."}
          </p>
        </section>
      ) : hasAnswers ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError(false);
            setBusy(true);
            try {
              if (!consent) return;
              const prepared = await callAction(
                "prepare_member_account",
                {
                  email,
                  consent: true,
                  profile: {
                    screener: coverageAnswers(answers),
                    language: es ? "es-US" : "en-US",
                  },
                },
                { method: "POST" },
              );
              const callback = new URL(
                prepared.callbackURL,
                window.location.origin,
              );
              callback.searchParams.set("lang", lang);
              prepared.callbackURL = callback.pathname + callback.search;
              const response = await fetch(
                "/_agent-native/auth/ba/sign-up/email",
                {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "accept-language": es ? "es-US" : "en-US",
                  },
                  body: JSON.stringify({
                    email,
                    password,
                    name: email,
                    callbackURL: prepared.callbackURL,
                  }),
                },
              );
              if (!response.ok) throw new Error("Account creation failed");
              setPassword("");
              setSent(true);
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            {es
              ? "Elige guardar estas respuestas en tu cuenta. Debes verificar tu correo antes de entrar."
              : "Choose to save these answers in your account. You must verify your email before you can sign in."}
          </p>
          <label htmlFor="email">{es ? "Correo electrónico" : "Email"}</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="password">
            {es
              ? "Contraseña (al menos 12 caracteres)"
              : "Password (at least 12 characters)"}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label className="choice">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            {es
              ? "Guarda mis respuestas en mi cuenta."
              : "Save my answers in my account."}
          </label>
          {error && (
            <p role="alert">
              {es
                ? "No pudimos crear la cuenta. Tus respuestas siguen aquí. Revisa tu conexión e inténtalo de nuevo."
                : "We could not create the account. Your answers are still here. Check your connection and try again."}
            </p>
          )}
          <button disabled={busy}>
            {busy
              ? es
                ? "Creando cuenta…"
                : "Creating account…"
              : es
                ? "Crear cuenta"
                : "Create account"}
          </button>
        </form>
      ) : (
        <p>
          {es
            ? "Primero responde las preguntas. No hay respuestas guardadas en esta página."
            : "Start with the screener. There are no answers kept in this page."}
        </p>
      )}
      {hasAnswers && !sent && (
        <details open>
          <summary>{es ? "Tus respuestas" : "Your answers"}</summary>
          <dl>
            {visibleQuestions(copy.questions, answers).map((question) => (
              <div key={question.key}>
                <dt>{question.text}</dt>
                <dd>
                  {question.key === "group"
                    ? copy.groupChoices[
                        (answers.group || "") as keyof typeof copy.groupChoices
                      ]
                    : !answers[question.key] ||
                        answers[question.key] === "unknown"
                      ? es
                        ? "No sé"
                        : "Not sure"
                      : answers[question.key] === "yes"
                        ? es
                          ? "Sí"
                          : "Yes"
                        : answers[question.key] === "no"
                          ? "No"
                          : answers[question.key]}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {busy && <p role="status">{es ? "Guardando…" : "Saving…"}</p>}
      {error && verified === false && sent === false && !hasAnswers && (
        <p role="alert">
          {es
            ? "No pudimos guardar las respuestas. Vuelve a las preguntas e inténtalo de nuevo."
            : "We could not save your answers. Return to the screener and try again."}
        </p>
      )}
      <div className="actions">
        <Link className="button secondary" to={languageLink("/check", lang)}>
          {es ? "Volver a mis respuestas" : "Back to my answers"}
        </Link>
      </div>
    </>
  );
}
