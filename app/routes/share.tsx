import { useState } from "react";

import { useLanguage, languageLink } from "../lib/language";
export default function Share() {
  const lang = useLanguage(),
    es = lang === "es";
  const [message, setMessage] = useState("");
  const text = es
    ? "La nueva regla de trabajo de Medicaid puede afectarte. Esta herramienta gratis explica la regla y qué pruebas guardar: "
    : "Medicaid’s work rule may affect you. This free tool explains the rule and what proof to keep: ";
  async function share() {
    const url = new URL(languageLink("/check", lang), window.location.origin);
    url.searchParams.set("from", "share");
    const value = text + url.href;
    try {
      if (navigator.share)
        await navigator.share({ title: "Eighty", text: value });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setMessage(
          es
            ? "Mensaje copiado. Pégalo donde quieras compartirlo."
            : "Message copied. Paste it where you want to share it.",
        );
      } else setMessage(value);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage(value);
    }
  }
  return (
    <>
      <h1>{es ? "Envía Eighty a alguien" : "Send Eighty to someone"}</h1>
      <p>
        {es
          ? "Comparte la regla con alguien a quien pueda afectar. No guardamos quién lo envía ni quién lo recibe."
          : "Share the rule with someone it may affect. We do not record who sends it or who receives it."}
      </p>
      <blockquote>{text}Eighty</blockquote>
      <button onClick={share}>
        {es ? "Compartir Eighty" : "Share Eighty"}
      </button>
      <p role="status" style={{ overflowWrap: "anywhere" }}>
        {message}
      </p>
    </>
  );
}
