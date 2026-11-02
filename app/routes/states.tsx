import { useState } from "react";

import states from "../../data/states.json";
import { useLanguage, languageLink } from "../lib/language";
export default function States() {
  const lang = useLanguage(),
    es = lang === "es";
  const [search, setSearch] = useState("");
  const shown = states.filter((state) =>
    `${state.name} ${state.code}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <h1>{es ? "Busca tu estado" : "Find your state"}</h1>
      <p>
        {es
          ? "Busca ayuda oficial de Medicaid. Las reglas y fechas de tu estado pueden variar."
          : "Find official Medicaid help. Your state’s rules and dates may differ."}
      </p>
      <label htmlFor="state-search">
        {es ? "Estado o código" : "State or code"}
      </label>
      <input
        id="state-search"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="state-list">
        {shown.map((state) => (
          <li key={state.code}>
            <a href={languageLink(`/states/${state.code.toLowerCase()}`, lang)}>
              {state.name}
            </a>
          </li>
        ))}
      </ul>
      {shown.length === 0 && (
        <p role="status">
          {es
            ? "No se encontró ese estado. Prueba con otro nombre."
            : "No state found. Try another name."}
        </p>
      )}
    </>
  );
}
