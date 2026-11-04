import { useEffect, useId, useRef, useState } from "react";

import {
  boxFromDrag,
  MIN_BOX,
  moveBox,
  resizeBox,
  clampBox,
  type CoverBox,
} from "../../../shared/cover-box";
import { burnInCover } from "../../lib/cover";
import { phonePreview } from "../../lib/prepare-photo";
import { fillIn, readerCopy } from "./reader-copy";

const NUDGE = 0.02;
const percent = (value: number) => Math.round(value * 100);

/**
 * Lets the member black out parts of a photo by touch, mouse or keyboard. The
 * boxes are painted into a new copy of the photo on the device; only that copy
 * is sent.
 */
export function CoverTool({
  file,
  rotation,
  es,
  onDone,
  onCancel,
}: {
  file: File;
  rotation: number;
  es: boolean;
  onDone: (covered: File) => void | Promise<void>;
  onCancel: () => void;
}) {
  const copy = readerCopy(es).cover;
  const titleId = useId(),
    helpId = useId();
  const [preview, setPreview] = useState<string | null>(null),
    [boxes, setBoxes] = useState<CoverBox[]>([]),
    [draft, setDraft] = useState<CoverBox | null>(null),
    [focus, setFocus] = useState<number | null>(null),
    [announce, setAnnounce] = useState(""),
    [working, setWorking] = useState(false),
    [failed, setFailed] = useState(false);
  const area = useRef<HTMLDivElement>(null),
    start = useRef<{ x: number; y: number } | null>(null),
    boxButtons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    let live = true;
    phonePreview(file, rotation)
      .then((url) => {
        if (!live) return;
        if (url) setPreview(url);
        else setFailed(true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [file, rotation]);
  useEffect(() => {
    if (focus !== null) boxButtons.current[focus]?.focus();
  }, [focus, boxes.length]);
  const label = (box: CoverBox, index: number) =>
    fillIn(copy.box, {
      number: index + 1,
      left: percent(box.x),
      top: percent(box.y),
      width: percent(box.width),
      height: percent(box.height),
    });
  function add(box: CoverBox) {
    const next = [...boxes, clampBox(box)];
    setBoxes(next);
    setAnnounce(fillIn(copy.added, { number: next.length }));
    return next.length - 1;
  }
  function remove(index: number) {
    const next = boxes.filter((_, i) => i !== index);
    setBoxes(next);
    setFocus(null);
    setAnnounce(fillIn(copy.removed, { count: next.length }));
  }
  function point(event: React.PointerEvent) {
    const rect = area.current!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }
  return (
    <section
      className="cover-tool"
      aria-labelledby={titleId}
      aria-describedby={helpId}
    >
      <h3 id={titleId}>{copy.title}</h3>
      <p id={helpId}>{copy.help}</p>
      <p className="note">{copy.keyboardHelp}</p>
      {!preview && !failed && <p role="status">{copy.loading}</p>}
      {preview && (
        <div
          className="cover-area"
          ref={area}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement).closest(".cover-box")) return;
            event.preventDefault();
            start.current = point(event);
            area.current?.setPointerCapture(event.pointerId);
            setDraft(boxFromDrag(start.current, start.current));
          }}
          onPointerMove={(event) => {
            if (start.current)
              setDraft(boxFromDrag(start.current, point(event)));
          }}
          onPointerUp={(event) => {
            const from = start.current;
            start.current = null;
            setDraft(null);
            if (!from) return;
            const box = boxFromDrag(from, point(event));
            if (box.width >= MIN_BOX && box.height >= MIN_BOX) add(box);
          }}
          onPointerCancel={() => {
            start.current = null;
            setDraft(null);
          }}
        >
          <img src={preview} alt={copy.image} draggable={false} />
          {boxes.map((box, index) => (
            <button
              type="button"
              key={index}
              ref={(element) => {
                boxButtons.current[index] = element;
              }}
              className="cover-box"
              aria-label={label(box, index)}
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.width * 100}%`,
                height: `${box.height * 100}%`,
              }}
              onKeyDown={(event) => {
                const moves: Record<string, [number, number]> = {
                  ArrowLeft: [-NUDGE, 0],
                  ArrowRight: [NUDGE, 0],
                  ArrowUp: [0, -NUDGE],
                  ArrowDown: [0, NUDGE],
                };
                const move = moves[event.key];
                if (move) {
                  event.preventDefault();
                  const next = event.shiftKey
                    ? resizeBox(box, move[0], move[1])
                    : moveBox(box, move[0], move[1]);
                  setBoxes(boxes.map((b, i) => (i === index ? next : b)));
                  setAnnounce(label(next, index));
                } else if (
                  event.key === "Delete" ||
                  event.key === "Backspace"
                ) {
                  event.preventDefault();
                  remove(index);
                }
              }}
            />
          ))}
          {draft && (
            <div
              className="cover-box draft"
              aria-hidden="true"
              style={{
                left: `${draft.x * 100}%`,
                top: `${draft.y * 100}%`,
                width: `${draft.width * 100}%`,
                height: `${draft.height * 100}%`,
              }}
            />
          )}
        </div>
      )}
      <p role="status" aria-live="polite" className="note">
        {announce}
      </p>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={!preview || working}
          onClick={() =>
            setFocus(add({ x: 0.35, y: 0.45, width: 0.3, height: 0.08 }))
          }
        >
          {copy.add}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!boxes.length || working}
          onClick={() => remove(boxes.length - 1)}
        >
          {copy.undo}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!boxes.length || working}
          onClick={() => {
            setBoxes([]);
            setFocus(null);
            setAnnounce(fillIn(copy.removed, { count: 0 }));
          }}
        >
          {copy.clear}
        </button>
      </div>
      {failed && <p role="alert">{copy.failed}</p>}
      <div className="actions">
        <button
          type="button"
          disabled={!boxes.length || working}
          onClick={async () => {
            setWorking(true);
            setFailed(false);
            try {
              await onDone(await burnInCover(file, rotation, boxes));
            } catch {
              setFailed(true);
            } finally {
              setWorking(false);
            }
          }}
        >
          {working ? copy.working : copy.done}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={working}
          onClick={onCancel}
        >
          {copy.cancel}
        </button>
      </div>
    </section>
  );
}
