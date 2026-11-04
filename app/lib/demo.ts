import { callAction } from "@agent-native/core/client/hooks";

import en from "../../locales/en-US.json";
import es from "../../locales/es-US.json";
import { languageLink, type Language } from "./language";

export type DemoPerson = "maria" | "daniel" | "rosa";
export const demoCopy = (lang: Language) => (lang === "es" ? es : en).demo;
export function fill(text: string, values: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, key: string) =>
    String(values[key] ?? ""),
  );
}

const HINT = "eighty_demo";
// The hint only decides whether to ask the server. It grants nothing.
export function hasDemoHint() {
  return (
    typeof document !== "undefined" &&
    document.cookie.split(";").some((part) => part.trim() === `${HINT}=1`)
  );
}
function clearDemoHint() {
  document.cookie = `${HINT}=; Max-Age=0; Path=/; SameSite=Lax`;
}

type DemoState = { demo: boolean; person?: DemoPerson };
let status: Promise<DemoState> | null = null;
export function demoStatus(): Promise<DemoState> {
  if (!hasDemoHint()) return Promise.resolve({ demo: false });
  status ??= (
    callAction("demo_status", {}, { method: "GET" }) as Promise<{
      demo: boolean;
      person?: DemoPerson;
    }>
  ).catch((error: { status?: number }) => {
    status = null;
    if (error?.status === 401) {
      clearDemoHint();
      return { demo: false };
    }
    throw error;
  });
  return status;
}

export type OpenFailure = "limit" | "closed" | "offline" | "error";
export async function openDemo(
  person: DemoPerson,
  lang: Language,
): Promise<OpenFailure | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  try {
    const started = (await callAction(
      "start_demo",
      { person, language: lang },
      { method: "POST" },
    )) as { ticket: string };
    const entered = await fetch("/enter-demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ ticket: started.ticket }),
    });
    if (!entered.ok) return "error";
    status = null;
    window.location.assign(languageLink("/demo", lang));
    return null;
  } catch (error) {
    const code = (error as { status?: number })?.status;
    if (code === 429) return "limit";
    if (code === 503) return "closed";
    if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
    return "error";
  }
}

export async function leaveDemo(lang: Language) {
  const response = await fetch("/_agent-native/auth/ba/sign-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  if (!response.ok) throw new Error("sign-out");
  clearDemoHint();
  status = null;
  window.location.assign(languageLink("/", lang));
}
