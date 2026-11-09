import { useLoaderData, type LoaderFunctionArgs } from "react-router";

import states from "../../data/states.json";
import { useLanguage, languageLink } from "../lib/language";
export function loader({ params }: LoaderFunctionArgs) {
  const state = states.find((item) => item.code === params.code?.toUpperCase());
  if (!state) throw new Response("Not found", { status: 404 });
  return state;
}
export default function State() {
  const state = useLoaderData<typeof loader>();
  const lang = useLanguage(),
    es = lang === "es";
  return (
    <>
      <p className="eyebrow">
        {es ? "Medicaid · Ayuda oficial" : "Medicaid · Official help"}
      </p>
      <h1>{state.name}</h1>
      <p>
        {state.expandedMedicaid
          ? es
            ? "Este estado amplió Medicaid. La regla federal puede aplicarte según tu grupo de cobertura."
            : "This state expanded Medicaid. The federal rule may apply based on your coverage group."
          : es
            ? "Este estado no amplió Medicaid. La regla federal de expansión no se aplica a sus grupos tradicionales de Medicaid."
            : "This state has not expanded Medicaid. The federal expansion rule does not apply to its traditional Medicaid groups."}
      </p>
      {state.code === "GA" && (
        <p>
          {es
            ? "Georgia tiene un programa aparte llamado Pathways. Pregunta al estado por sus propias reglas."
            : "Georgia has a separate Pathways program. Ask the state about its own rules."}
        </p>
      )}
      <p>
        {es
          ? "Perfil: la regla federal. Tu estado fija sus propias opciones y fechas; confirma con el estado la fecha que te aplica."
          : "Profile: the federal rule. Your state sets its own choices and dates; confirm your start date with the state."}
      </p>
      <section className="card">
        <h2>{es ? "Contacta al estado" : "Contact your state"}</h2>
        <p>{state.agency}</p>
        {state.contactUrl && (
          <p>
            <a href={state.contactUrl}>
              {es ? "Contactos oficiales" : "Official contacts"}
            </a>
          </p>
        )}
        {state.enrollmentUrl && (
          <p>
            <a href={state.enrollmentUrl}>
              {es
                ? "Ayuda oficial para solicitar cobertura"
                : "Official help to apply for coverage"}
            </a>
          </p>
        )}
        <ul>
          {state.phones.map((phone, index) => (
            <li key={index}>
              <a href={phone.href}>{phone.number}</a>
            </li>
          ))}
        </ul>
      </section>
      <p>
        <a href="https://localhelp.healthcare.gov/">
          {es ? "Buscar ayuda local" : "Find local help"}
        </a>
      </p>
      <p>
        <a href={state.fieldSources.name.source}>
          {es ? "Fuente de los contactos: CMS" : "Contact source: CMS"}
        </a>{" "}
        · {state.fieldSources.name.checkedOn}
      </p>
      <p className="note">
        <a href={state.fieldSources.expandedMedicaid.source}>
          {es
            ? "Fuente del estado de expansión: CMS"
            : "Expansion status source: CMS"}
        </a>{" "}
        · {state.fieldSources.expandedMedicaid.checkedOn}
      </p>
      <p>
        <a href={languageLink("/check", lang)}>
          {es ? "Revisar si me aplica" : "Check if it applies to me"}
        </a>
      </p>
    </>
  );
}
