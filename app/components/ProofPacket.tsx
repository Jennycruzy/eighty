import { callAction } from "@agent-native/core/client/hooks";
import { useState } from "react";

import { useLanguage } from "../lib/language";

interface Packet {
  filename: string;
  data: string;
  pages: number;
  documents: number;
  month: string;
  email: { subject: string; body: string };
}

const COPY = {
  en: {
    title: "Your proof packet",
    ready: (month: string) =>
      `${month} meets the rule with your confirmed proof. The packet is a cover page with the rule and a signature line, then your documents.`,
    download: "Download the packet (PDF)",
    making: "Making the packet…",
    made: (pages: number, docs: number) =>
      `Saved: ${pages === 1 ? "1 page" : `${pages} pages`}${docs ? `, ${docs === 1 ? "1 document" : `${docs} documents`}` : ""}.`,
    email: "Write the email",
    emailNote: "Your mail app opens with the email written. Attach the PDF you saved and send it to your state's Medicaid office.",
    error: "That didn't work. Try again.",
  },
  es: {
    title: "Tu paquete de prueba",
    ready: (month: string) =>
      `${month} cumple la regla con tus pruebas confirmadas. El paquete tiene una portada con la regla y una línea para firmar, y después tus documentos.`,
    download: "Descargar el paquete (PDF)",
    making: "Haciendo el paquete…",
    made: (pages: number, docs: number) =>
      `Guardado: ${pages === 1 ? "1 página" : `${pages} páginas`}${docs ? `, ${docs === 1 ? "1 documento" : `${docs} documentos`}` : ""}.`,
    email: "Escribir el correo",
    emailNote: "Tu app de correo se abre con el correo escrito. Adjunta el PDF que guardaste y envíalo a la oficina de Medicaid de tu estado.",
    error: "No funcionó. Inténtalo otra vez.",
  },
};

/** The packet for one finished month: the PDF to save and the email to send. */
export function ProofPacket({ month }: { month: string }) {
  const lang = useLanguage(),
    es = lang === "es",
    copy = COPY[es ? "es" : "en"];
  const [packet, setPacket] = useState<Packet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const shown = new Date(`${month}-15T12:00:00Z`).toLocaleDateString(
    es ? "es-US" : "en-US",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  async function download() {
    setBusy(true);
    setError(false);
    try {
      const made = (await callAction(
        "proof_packet",
        { month, language: es ? "es" : "en" },
        { method: "POST", uiOnly: true },
      )) as Packet;
      const bytes = Uint8Array.from(atob(made.data), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = made.filename;
      document.body.append(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPacket(made);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const mailto = packet
    ? `mailto:?subject=${encodeURIComponent(packet.email.subject)}&body=${encodeURIComponent(packet.email.body)}`
    : null;
  return (
    <div className="mw-card mw-packet">
      <h3>{copy.title}</h3>
      <p>{copy.ready(shown)}</p>
      <div className="packet-actions">
        <button type="button" disabled={busy} onClick={() => void download()}>
          {busy ? copy.making : copy.download}
        </button>
        {mailto && (
          <a className="button secondary" href={mailto}>
            {copy.email}
          </a>
        )}
      </div>
      {packet && (
        <p className="note" aria-live="polite">
          {copy.made(packet.pages, packet.documents)} {copy.emailNote}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {copy.error}
        </p>
      )}
    </div>
  );
}
