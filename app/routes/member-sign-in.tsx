import { useState } from "react";
import { Link, useSearchParams } from "react-router";

import { safeMemberNext } from "../../shared/access";
import { useLanguage, languageLink } from "../lib/language";
export function headers() {
  return {
    "x-agent-native-ssr-max-age": "0",
    "Cache-Control": "private, no-store",
  };
}
export default function MemberSignIn() {
  const [params] = useSearchParams();
  const lang = useLanguage(),
    es = lang === "es";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <>
      <h1>{es ? "Entrar a mi cuenta" : "Sign in to my account"}</h1>
      <p>
        {es
          ? "Solo para cuentas con correo verificado. Aún no puedes crear una cuenta."
          : "For accounts with a verified email. Account creation is still closed."}
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setBusy(true);
          setError(false);
          try {
            const response = await fetch(
              "/_agent-native/auth/ba/sign-in/email",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: form.get("email"),
                  password: form.get("password"),
                }),
              },
            );
            if (!response.ok) throw new Error();
            const target = new URL(
              safeMemberNext(params.get("next")) || "/months",
              window.location.origin,
            );
            target.searchParams.set("lang", lang);
            window.location.assign(
              `${target.pathname}${target.search}${target.hash}`,
            );
          } catch {
            setError(true);
            setBusy(false);
          }
        }}
      >
        <label>
          {es ? "Correo" : "Email"}
          <input type="email" name="email" autoComplete="username" required />
        </label>
        <label>
          {es ? "Contraseña" : "Password"}
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert">
            {es
              ? "No pudimos entrar. Revisa tu correo, contraseña y conexión. Tu correo debe estar verificado."
              : "We could not sign you in. Check your email, password and connection. Your email must be verified."}
          </p>
        )}
        <button disabled={busy}>
          {busy
            ? es
              ? "Entrando…"
              : "Signing in…"
            : es
              ? "Entrar"
              : "Sign in"}
        </button>
      </form>
      <p>
        <Link to={languageLink("/check", lang)}>
          {es ? "Volver a las preguntas" : "Back to the questions"}
        </Link>
      </p>
    </>
  );
}
