import { useEffect, useState } from "react";

import {
  demoCopy,
  demoStatus,
  fill,
  leaveDemo,
  openDemo,
  type DemoPerson,
} from "../../lib/demo";
import { useLanguage } from "../../lib/language";

// Shown on every screen while the visitor is in a demo account.
export function DemoBand() {
  const lang = useLanguage();
  const copy = demoCopy(lang);
  const [person, setPerson] = useState<DemoPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    demoStatus()
      .then((result) => {
        if (active && result.demo && result.person) setPerson(result.person);
      })
      .catch(() => {
        /* A failed check leaves the page as it is; the server still applies the demo limits. */
      });
    return () => {
      active = false;
    };
  }, []);
  if (!person) return null;
  const name = copy.people[person].name;
  async function act(task: () => Promise<string | null | void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const failure = await task();
      if (failure) {
        setError(
          failure in copy.landing
            ? copy.landing[failure as keyof typeof copy.landing]
            : copy.band.error,
        );
        setBusy(false);
      }
    } catch {
      setError(copy.band.error);
      setBusy(false);
    }
  }
  return (
    <section className="demo-band" aria-label={copy.band.label}>
      <p>
        <strong>{fill(copy.band.text, { name })}</strong>
      </p>
      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => act(() => openDemo(person, lang))}
        >
          {busy ? copy.band.working : copy.band.again}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => act(() => leaveDemo(lang))}
        >
          {copy.band.leave}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
