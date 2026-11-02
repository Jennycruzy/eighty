import { createContext, useContext } from "react";
export type Language = "en" | "es";
export const LanguageContext = createContext<Language>("en");
export const useLanguage = () => useContext(LanguageContext);
export function languageLink(path: string, lang: Language) {
  return lang === "es" ? `${path}?lang=es` : path;
}
