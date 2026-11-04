import { useState } from "react";

import {
  demoCopy,
  openDemo,
  type DemoPerson,
  type OpenFailure,
} from "../../lib/demo";
import { useLanguage } from "../../lib/language";

// The landing page door into the demo. It works without an account.
export function DemoStart() {
  const lang = useLanguage();
  const copy = demoCopy(lang).landing;
  const [busy, setBusy] = useState<DemoPerson | null>(null);
  const [failure, setFailure] = useState<OpenFailure | null>(null);
  async function open(person: DemoPerson) {
    if (busy) return;
    setBusy(person);
    setFailure(null);
    const result = await openDemo(person, lang);
    // On success the page moves on; keep the button busy until it does.
    if (result) {
      setFailure(result);
      setBusy(null);
    }
  }
  return (
    <section className="card demo-start" aria-labelledby="demo-start-title">
      <h2 id="demo-start-title">{copy.title}</h2>
      <p>{copy.intro}</p>
      <button
        type="button"
        disabled={busy !== null}
        aria-busy={busy === "maria"}
        onClick={() => open("maria")}
      >
        {busy === "maria" ? copy.opening : copy.maria}
      </button>
      <p className="demo-others">
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
        ·{" "}
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
