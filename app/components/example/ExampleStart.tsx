import { useState } from "react";

import {
  exampleCopy,
  openExample,
  type ExamplePerson,
  type OpenFailure,
} from "../../lib/example";
import { useLanguage } from "../../lib/language";

// The landing page door into the example. It works without an account.
export function ExampleStart({ variant = "card" }: { variant?: "card" | "hero" } = {}) {
  const lang = useLanguage();
  const copy = exampleCopy(lang).landing;
  const [busy, setBusy] = useState<ExamplePerson | null>(null);
  const [failure, setFailure] = useState<OpenFailure | null>(null);
  async function open(person: ExamplePerson) {
    if (busy) return;
    setBusy(person);
    setFailure(null);
    const result = await openExample(person, lang);
    // On success the page moves on; keep the button busy until it does.
    if (result) {
      setFailure(result);
      setBusy(null);
    }
  }
  if (variant === "hero")
    return (
      <div className="lx-example" id="example-start-title" tabIndex={-1}>
        <button
          type="button"
          disabled={busy !== null}
          aria-busy={busy === "maria"}
          onClick={() => open("maria")}
        >
          {busy === "maria" ? copy.opening : copy.maria}
        </button>
        <p className="lx-others">
          {copy.others}{" "}
          <button
            type="button"
            className="link-button"
            disabled={busy !== null}
            aria-busy={busy === "daniel"}
            onClick={() => open("daniel")}
          >
            {copy.daniel}
          </button>{" "}
          {lang === "es" ? "o" : "or"}{" "}
          <button
            type="button"
            className="link-button"
            disabled={busy !== null}
            aria-busy={busy === "rosa"}
            onClick={() => open("rosa")}
          >
            {copy.rosa}
          </button>
        </p>
        {busy && busy !== "maria" && <p role="status">{copy.opening}</p>}
        {failure && (
          <p role="alert" className="error">
            {copy[failure]}
          </p>
        )}
      </div>
    );
  return (
    <section
      className="card example-start"
      aria-labelledby="example-start-title"
    >
      <h2 id="example-start-title">{copy.title}</h2>
      <p>{copy.intro}</p>
      <button
        type="button"
        disabled={busy !== null}
        aria-busy={busy === "maria"}
        onClick={() => open("maria")}
      >
        {busy === "maria" ? copy.opening : copy.maria}
      </button>
      <p className="example-others">
        {copy.others}{" "}
        <button
          type="button"
          className="link-button"
          disabled={busy !== null}
          aria-busy={busy === "daniel"}
          onClick={() => open("daniel")}
        >
          {copy.daniel}
        </button>{" "}
        {lang === "es" ? "o" : "or"}{" "}
        <button
          type="button"
          className="link-button"
          disabled={busy !== null}
          aria-busy={busy === "rosa"}
          onClick={() => open("rosa")}
        >
          {copy.rosa}
        </button>
      </p>
      {busy && busy !== "maria" && <p role="status">{copy.opening}</p>}
      {failure && (
        <p role="alert" className="error">
          {copy[failure]}
        </p>
      )}
    </section>
  );
}
