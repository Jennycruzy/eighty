import { useSearchParams } from "react-router";
import { useState } from "react";
import { useLanguage } from "../lib/language";

export function VerificationLink() {
  const [params] = useSearchParams();
  const draft = params.get("draft");
  const es = useLanguage() === "es";
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const email = new FormData(event.currentTarget).get(
          "verification-email",
        );
        try {
          const response = await fetch("/send-verification-link", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...(draft ? { draft } : { email }),
              language: es ? "es" : "en",
            }),
          });
          if (!response.ok) throw new Error();
          setMessage((await response.json()).message);
        } catch {
          setMessage(
            es
              ? "No se pudo enviar. Inténtalo de nuevo."
              : "Could not send. Try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {!draft && (
        <label>
          {es ? "Correo de tu cuenta" : "Your account email"}
          <input
            name="verification-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            required
          />
        </label>
      )}
      <button disabled={busy}>
        {es ? "Envíame un enlace nuevo" : "Send me a new link"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
