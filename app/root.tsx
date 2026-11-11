import { useState } from "react";
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useLocation,
  useRouteLoaderData,
} from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import type { ScreenerAnswers } from "../shared/screener";
import { ExampleNotice } from "./components/ExampleNotice";
import { ConnectionNotice } from "./components/public/ConnectionNotice";
import { LanguageContext, languageLink } from "./lib/language";
import { ScreenerDraftContext } from "./lib/screener-draft";

import stylesheet from "./public.css?url";
export const links = () => [{ rel: "stylesheet", href: stylesheet }];
// Link previews need a full address, and the app sits behind a proxy.
const SHARE_IMAGE = "https://tryeighty.space/og.png";
const SHARE_TITLE = {
  en: "Eighty · Keep your Medicaid. Eighty does the paperwork.",
  es: "Eighty · Conserva tu Medicaid. Eighty hace el papeleo.",
};
const DESCRIPTION = {
  en: "Send a photo or a voice note. Eighty counts your hours and pay against Medicaid's 80-hour work rule and builds the proof for your state. The state decides.",
  es: "Envía una foto o una nota de voz. Eighty cuenta tus horas y tu pago según la regla de 80 horas de Medicaid y prepara la prueba para tu estado. El estado decide.",
};
const SHARE_ALT = {
  en: "Eighty: a month's hours and pay shown as two rings",
  es: "Eighty: las horas y el pago de un mes en dos anillos",
};
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
        <meta name="theme-color" content="#000000" />
        <meta
          name="description"
          content={data?.lang === "es" ? DESCRIPTION.es : DESCRIPTION.en}
        />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Eighty" />
        <meta
          property="og:title"
          content={data?.lang === "es" ? SHARE_TITLE.es : SHARE_TITLE.en}
        />
        <meta
          property="og:description"
          content={data?.lang === "es" ? DESCRIPTION.es : DESCRIPTION.en}
        />
        <meta property="og:image" content={SHARE_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content={data?.lang === "es" ? SHARE_ALT.es : SHARE_ALT.en}
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={SHARE_IMAGE} />
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
  const [questionIndex, setQuestionIndex] = useState(0);
  const link = (path: string) => languageLink(path, lang);
  const landing = useLocation().pathname === "/";
  return (
    <LanguageContext value={lang}>
      <a className="skip-link" href="#main">
        {lang === "es" ? "Ir al contenido" : "Skip to content"}
      </a>
      <header className="site-header">
        <div className="inner">
          <a className="brand" href={link("/")} aria-label="Eighty">
            <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
              <circle cx="13" cy="13" r="10.5" fill="none" stroke="rgba(255,45,85,.25)" strokeWidth="4" />
              <circle cx="13" cy="13" r="10.5" fill="none" stroke="#ff2d55" strokeWidth="4" strokeLinecap="round" strokeDasharray="50 66" transform="rotate(-90 13 13)" />
              <circle cx="13" cy="13" r="4.5" fill="none" stroke="rgba(166,244,0,.25)" strokeWidth="4" />
              <circle cx="13" cy="13" r="4.5" fill="none" stroke="#a6f400" strokeWidth="4" strokeLinecap="round" strokeDasharray="20 29" transform="rotate(-90 13 13)" />
            </svg>
            <span>
              eighty<span aria-hidden="true">.</span>
            </span>
          </a>
          <nav aria-label={lang === "es" ? "Menú principal" : "Main menu"}>
            <a className="wide" href={link("/how-it-works")}>
              {lang === "es" ? "Cómo funciona" : "How it works"}
            </a>
            <a className="wide" href={link("/help")}>
              {lang === "es" ? "Ayuda" : "Help"}
            </a>
            <a href={link("/check/sign-in")}>
              {lang === "es" ? "Entrar" : "Sign in"}
            </a>
            <Link
              to={lang === "en" ? "?lang=es" : "?lang=en"}
              lang={lang === "en" ? "es" : "en"}
            >
              {lang === "en" ? "Español" : "English"}
            </Link>
          </nav>
        </div>
      </header>
      <ScreenerDraftContext
        value={{ answers, setAnswers, questionIndex, setQuestionIndex }}
      >
        <main id="main" className={landing ? "landing-page" : "narrow-page"}>
          <ConnectionNotice />
          <ExampleNotice />
          <Outlet />
        </main>
      </ScreenerDraftContext>
      <footer className="site-footer">
        <div className="inner">
        <p>
          {lang === "es"
            ? "Eighty no es el estado. Tu estado decide. Tú envías tus pruebas al estado."
            : "Eighty is not the state. Your state decides. You send your proof to the state."}
        </p>
        <nav
          aria-label={lang === "es" ? "Más información" : "More information"}
        >
          {[
            ["/how-it-works", "How it works", "Cómo funciona"],
            ["/help", "Help", "Ayuda"],
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
        </div>
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
