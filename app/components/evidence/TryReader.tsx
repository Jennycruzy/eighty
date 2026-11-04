import { callAction } from "@agent-native/core/client/hooks";
import { useState } from "react";

import type { TryFill } from "../../../shared/try-month";
import {
  fileBase64,
  phonePreview,
  preparePhoneFile,
} from "../../lib/prepare-photo";
import { CoverTool } from "./CoverTool";
import { fillIn, readerCopy } from "./reader-copy";

type Outcome =
  | "read"
  | "nothing-found"
  | "not-us-document"
  | "unreadable"
  | "unavailable"
  | "visitor-limit"
  | "budget-used";
interface Answer {
  outcome: Outcome;
  fill?: TryFill;
  pages: number;
  pagesRead: number;
  deletedAt: string;
}

/**
 * One document for a visitor with no account. It is read in memory on the
 * server and deleted; the numbers fill the form for the visitor to check.
 */
export function TryReader({
  es,
  onFill,
  onTypeInstead,
}: {
  es: boolean;
  onFill: (fill: TryFill) => void;
  onTypeInstead: () => void;
}) {
  const all = readerCopy(es),
    copy = all.try;
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<string | null>(null),
    [covering, setCovering] = useState(false),
    [covered, setCovered] = useState(false),
    [preparing, setPreparing] = useState(false),
    [fileProblem, setFileProblem] = useState(false),
    [phase, setPhase] = useState<
      "idle" | "reading" | "slow" | "done" | "failed" | "offline"
    >("idle"),
    [answer, setAnswer] = useState<Answer | null>(null);
  const busy = phase === "reading" || phase === "slow" || preparing;
  function reset() {
    setFile(null);
    setPreview(null);
    setCovering(false);
    setCovered(false);
    setFileProblem(false);
    setPhase("idle");
    setAnswer(null);
  }
  async function read() {
    if (!file) return;
    if (!navigator.onLine) {
      setPhase("offline");
      return;
    }
    setPhase("reading");
    const slow = setTimeout(
      () => setPhase((now) => (now === "reading" ? "slow" : now)),
      15_000,
    );
    try {
      const result = (await callAction(
        "try_read_document",
        {
          data: await fileBase64(file),
          rotation: 0,
          language: es ? "es" : "en",
        },
        { method: "POST" },
      )) as Answer;
      // Our copy is gone; drop the page's copy too.
      setFile(null);
      setPreview(null);
      setAnswer(result);
      setPhase("done");
      if (result.fill) onFill(result.fill);
    } catch {
      setPhase(navigator.onLine ? "failed" : "offline");
    } finally {
      clearTimeout(slow);
    }
  }
  const time = answer
    ? new Date(answer.deletedAt).toLocaleTimeString(es ? "es-US" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
    : "";
  const failure =
    phase === "failed"
      ? all.failed
      : phase === "offline"
        ? copy.offline
        : answer?.outcome === "nothing-found"
          ? all.nothing
          : answer?.outcome === "not-us-document"
            ? all.notUs
            : answer?.outcome === "unreadable"
              ? all.unreadable
              : answer?.outcome === "unavailable"
                ? all.unavailable
                : answer?.outcome === "visitor-limit"
                  ? copy.visitorLimit
                  : answer?.outcome === "budget-used"
                    ? copy.budgetUsed
                    : null;
  return (
    <section className="card try-reader" aria-labelledby="try-reader-title">
      <h2 id="try-reader-title">{copy.title}</h2>
      <p>{copy.intro}</p>
      {!answer && !covering && (
        <label>
          {copy.choose}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
            disabled={busy}
            onChange={async (event) => {
              const next = event.target.files?.[0] || null;
              event.target.value = "";
              reset();
              if (!next) return;
              setPreparing(true);
              try {
                const prepared = await preparePhoneFile(next);
                setPreview(await phonePreview(prepared.file, 0));
                setFile(prepared.file);
              } catch {
                setFileProblem(true);
              } finally {
                setPreparing(false);
              }
            }}
          />
        </label>
      )}
      {fileProblem && <p role="alert">{copy.fileProblem}</p>}
      {covering && file && (
        <CoverTool
          file={file}
          rotation={0}
          es={es}
          onCancel={() => setCovering(false)}
          onDone={async (copyOfPhoto) => {
            setPreview(await phonePreview(copyOfPhoto, 0));
            setFile(copyOfPhoto);
            setCovering(false);
            setCovered(true);
          }}
        />
      )}
      {file && !covering && !answer && (
        <>
          {covered && <p role="status">{all.cover.applied}</p>}
          {preview ? (
            <img
              className="photo-preview"
              src={preview}
              alt={es ? "Vista de tu foto" : "Your photo preview"}
            />
          ) : (
            <p className="note">{all.cover.notPhoto}</p>
          )}
          <div className="actions">
            <button type="button" disabled={busy} onClick={() => void read()}>
              {busy ? all.reading : copy.read}
            </button>
            {preview && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setCovering(true)}
              >
                {all.cover.open}
              </button>
            )}
          </div>
        </>
      )}
      {(phase === "reading" || phase === "slow") && (
        <p role="status" aria-live="polite">
          {phase === "slow" ? `${all.reading} ${all.slow}` : all.reading}
        </p>
      )}
      {answer?.outcome === "read" && answer.fill && (
        <div role="status" aria-live="polite">
          <p>{copy.filled}</p>
          {answer.fill.unsure.length > 0 && (
            <div className="check-this">
              <h3>{all.checkThis}</h3>
              <p>{copy.unsureIntro}</p>
              <ul>
                {answer.fill.unsure.map((key) => (
                  <li key={key}>{copy.labels[key]}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {failure && (
        <div role="alert">
          <p>{failure}</p>
          <button type="button" className="secondary" onClick={onTypeInstead}>
            {copy.typeBelow}
          </button>
        </div>
      )}
      {answer && answer.pages > answer.pagesRead && (
        <p>
          {fillIn(all.pagesLimit, {
            read: answer.pagesRead,
            total: answer.pages,
          })}
        </p>
      )}
      {answer && <p role="status">{fillIn(copy.deleted, { time })}</p>}
      {(answer || phase === "failed" || phase === "offline") && (
        <div className="actions">
          {phase !== "done" && file && (
            <button type="button" onClick={() => void read()}>
              {all.readAgain}
            </button>
          )}
          <button type="button" className="secondary" onClick={reset}>
            {copy.another}
          </button>
        </div>
      )}
    </section>
  );
}
