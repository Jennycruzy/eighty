import { useState } from "react";
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import type { ScreenerAnswers } from "../shared/screener";
import { DemoBand } from "./components/demo/DemoBand";
import { ConnectionNotice } from "./components/public/ConnectionNotice";
import { LanguageContext, languageLink } from "./lib/language";
import { ScreenerDraftContext } from "./lib/screener-draft";

import stylesheet from "./public.css?url";
export const links = () => [{ rel: "stylesheet", href: stylesheet }];
export function loader({ request }: LoaderFunctionArgs) {
  return {
    lang:
      new URL(request.url).searchParams.get("lang") === "es"
        ? ("es" as const)
        : ("en" as const),
  };
}
export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData("root") as { lang?: string } | undefined;
  return (
    <html lang={data?.lang === "es" ? "es-US" : "en-US"}>
      <head>
        <meta charSet="utf-8" />
        <title>
          {data?.lang === "es"
            ? "Eighty · Pruebas para Medicaid"
            : "Eighty · Medicaid proof, in plain words"}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
export default function Root() {
  const { lang } = useLoaderData<typeof loader>();
  const [answers, setAnswers] = useState<ScreenerAnswers>({});
  const [step, setStep] = useState(0);
  const link = (path: string) => languageLink(path, lang);
  return (
    <LanguageContext value={lang}>
      <a className="skip-link" href="#main">
        {lang === "es" ? "Ir al contenido" : "Skip to content"}
      </a>
      <header>
        <a className="brand" href={link("/")} aria-label="Eighty">
          eighty<span aria-hidden="true">.</span>
        </a>
        <nav aria-label={lang === "es" ? "Menú principal" : "Main menu"}>
          <a href={link("/help")}>{lang === "es" ? "Ayuda" : "Help"}</a>
          <Link
            to={lang === "en" ? "?lang=es" : "?lang=en"}
            lang={lang === "en" ? "es" : "en"}
          >
            {lang === "en" ? "Español" : "English"}
          </Link>
        </nav>
      </header>
      <ScreenerDraftContext value={{ answers, setAnswers, step, setStep }}>
        <main id="main">
          <ConnectionNotice />
          <DemoBand />
          <Outlet />
        </main>
      </ScreenerDraftContext>
      <footer>
        <p>
          {lang === "es"
            ? "Eighty no es el estado. Tu estado decide. Tú envías tus pruebas al estado."
            : "Eighty is not the state. Your state decides. You send your proof to the state."}
        </p>
        <nav
          aria-label={lang === "es" ? "Más información" : "More information"}
        >
          {[
            ["/about", "About", "Acerca de"],
            ["/privacy", "Privacy", "Privacidad"],
            ["/terms", "Terms", "Términos"],
            ["/accessibility", "Access", "Acceso"],
            ["/security", "Security", "Seguridad"],
            ["/proof", "Proof", "Pruebas"],
          ].map(([path, en, es]) => (
            <a key={path} href={link(path!)}>
              {lang === "es" ? es : en}
            </a>
          ))}
        </nav>
      </footer>
    </LanguageContext>
  );
}
export function ErrorBoundary() {
  return (
    <main>
      <h1>We could not load this page / No se pudo abrir la página</h1>
      <p>Try again. / Inténtalo de nuevo.</p>
      <a href="/">Eighty</a>
    </main>
  );
}
