import { useLanguage, languageLink } from "../lib/language";
export function loader() {
  throw new Response("Not found", { status: 404 });
}
export default function NotFound() {
  const lang = useLanguage();
  return (
    <>
      <h1>{lang === "es" ? "No se encontró la página" : "Page not found"}</h1>
      <a href={languageLink("/", lang)}>
        {lang === "es" ? "Volver al inicio" : "Go to the home page"}
      </a>
    </>
  );
}
