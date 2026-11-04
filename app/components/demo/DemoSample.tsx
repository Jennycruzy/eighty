import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";

import { demoCopy, demoStatus } from "../../lib/demo";
import { useLanguage } from "../../lib/language";

// Maria's 60-second path: one tap saves the sample as her own upload. Until a
// document reader is added, the typed-entry form opens for its facts.
export function DemoSample({
  busy,
  work,
  onSaved,
}: {
  busy: boolean;
  work: (task: () => Promise<void>) => Promise<void>;
  onSaved: (id: string) => Promise<void>;
}) {
  const lang = useLanguage();
  const copy = demoCopy(lang).sample;
  const [show, setShow] = useState(false);
  const [state, setState] = useState<"" | "working" | "saved" | "error">("");
  useEffect(() => {
    let active = true;
    demoStatus()
      .then((result) => {
        if (active) setShow(result.demo && result.person === "maria");
      })
      .catch(() => {
        /* Without the check, the normal upload stays available. */
      });
    return () => {
      active = false;
    };
  }, []);
  if (!show) return null;
  return (
    <section className="card demo-sample" aria-labelledby="demo-sample-title">
      <h2 id="demo-sample-title">{copy.title}</h2>
      <p>{copy.intro}</p>
      <button
        type="button"
        disabled={busy || state === "working"}
        onClick={() =>
          work(async () => {
            setState("working");
            try {
              const saved = (await callAction(
                "add_demo_sample",
                {},
                { method: "POST", uiOnly: true },
              )) as { id: string };
              setState("saved");
              await onSaved(saved.id);
            } catch (error) {
              setState("error");
              throw error;
            }
          })
        }
      >
        {state === "working" ? copy.working : copy.button}
      </button>
      {state === "saved" && <p role="status">{copy.saved}</p>}
      {state === "error" && (
        <p role="alert" className="error">
          {copy.error}
        </p>
      )}
      <p>{copy.hint}</p>
      <p>
        <a href="/demo/maria-earnings-sample.png">{copy.picture}</a>
      </p>
    </section>
  );
}
