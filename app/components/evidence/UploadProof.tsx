import { callAction } from "@agent-native/core/client/hooks";
import { useState } from "react";

import {
  fileBase64,
  phonePreview,
  preparePhoneFile,
  type PhoneFileError,
} from "../../lib/prepare-photo";
import { CoverTool } from "./CoverTool";
import { DocumentView, type DocumentData } from "./DocumentView";
import { readerCopy } from "./reader-copy";
interface Checked extends DocumentData {
  quality: { dark: boolean; blurry: boolean } | null;
}
export function UploadProof({
  es,
  busy,
  work,
  onSaved,
}: {
  es: boolean;
  busy: boolean;
  work: (task: () => Promise<void>) => Promise<void>;
  onSaved: (id: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0),
    [checked, setChecked] = useState<Checked | null>(null),
    [localPreview, setLocalPreview] = useState<string | null>(null),
    [acceptQuality, setAcceptQuality] = useState(false);
  const [smaller, setSmaller] = useState(false),
    [smallerSaved, setSmallerSaved] = useState(false),
    [fileError, setFileError] = useState<PhoneFileError | null>(null),
    [covering, setCovering] = useState(false),
    [covered, setCovered] = useState(false);
  const cover = readerCopy(es).cover;
  return (
    <section className="card">
      <h2>{es ? "Añadir una foto o PDF" : "Add a photo or PDF"}</h2>
      <p>
        {es
          ? "Guardamos el archivo cifrado. Si una foto es muy grande, tu teléfono hace una copia más pequeña antes de enviarla. Tú conservas la foto completa en tu teléfono. PDF y HEIC: hasta 15 MB. PDF: hasta 40 páginas. HEIC: hasta 40 millones de píxeles."
          : "We keep the saved file encrypted. If a photo is too large, your phone makes a smaller copy before sending it. You keep the full photo on your phone. PDF and HEIC: up to 15 MB. PDFs: up to 40 pages. HEIC: up to 40 million pixels."}
      </p>
      <label>
        {es ? "Elegir archivo" : "Choose a file"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
          disabled={busy}
          onChange={(event) => {
            const next = event.target.files?.[0] || null;
            event.target.value = "";
            setFile(null);
            setFileError(null);
            setSmaller(false);
            setSmallerSaved(false);
            setRotation(0);
            setChecked(null);
            setAcceptQuality(false);
            setLocalPreview(null);
            setCovering(false);
            setCovered(false);
            if (next)
              void work(async () => {
                try {
                  const prepared = await preparePhoneFile(next);
                  setLocalPreview(await phonePreview(prepared.file, 0));
                  setFile(prepared.file);
                  setSmaller(prepared.smaller);
                } catch (error) {
                  setFileError(
                    error instanceof Error
                      ? (error.message as PhoneFileError)
                      : "photo-read",
                  );
                }
              });
          }}
        />
      </label>
      {fileError && (
        <p role="alert">
          {fileError === "pdf-too-large"
            ? es
              ? "Este PDF supera 15 MB. Divídelo en archivos más pequeños o toma fotos de sus páginas. También puedes escribir los datos."
              : "This PDF is over 15 MB. Split it into smaller files or take photos of its pages. You can also type the facts."
            : fileError === "heic-too-large"
              ? es
                ? "Esta foto HEIC supera 15 MB. Guárdala como JPEG o usa una resolución más baja. También puedes escribir los datos."
                : "This HEIC photo is over 15 MB. Save it as JPEG or use a lower photo size. You can also type the facts."
              : es
                ? "Tu teléfono no pudo reducir este archivo. Elige una foto más pequeña o escribe los datos."
                : "Your phone could not make this file smaller. Choose a smaller photo or type the facts."}
        </p>
      )}
      <p className="note">
        {es
          ? "Si un HEIC tiene demasiados píxeles, guárdalo como JPEG o toma otra foto con una resolución más baja."
          : "If a HEIC has too many pixels, save it as JPEG or take a new photo at a lower size."}
      </p>
      {smaller && file && (
        <p role="status">
          {es
            ? "Esta foto es muy grande. Guardaremos una copia más pequeña."
            : "This photo is too large. We will save a smaller copy."}
        </p>
      )}
      {smallerSaved && (
        <p role="status">
          {es
            ? "Guardamos una copia más pequeña de tu foto."
            : "We saved a smaller copy of your photo."}
        </p>
      )}
      {covered && file && !checked && <p role="status">{cover.applied}</p>}
      {file && !checked && !localPreview && !covering && (
        <p className="note">{cover.notPhoto}</p>
      )}
      {covering && file && (
        <CoverTool
          file={file}
          rotation={rotation}
          es={es}
          onCancel={() => setCovering(false)}
          onDone={async (copy) => {
            setLocalPreview(await phonePreview(copy, 0));
            setFile(copy);
            setRotation(0);
            setCovering(false);
            setCovered(true);
          }}
        />
      )}
      {localPreview && !checked && !covering && (
        <img
          className="photo-preview"
          src={localPreview}
          alt={es ? "Vista de tu foto" : "Your photo preview"}
        />
      )}
      {file && !checked && !covering && (
        <div className="actions">
          {localPreview && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setCovering(true)}
            >
              {cover.open}
            </button>
          )}
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              work(async () => {
                const next = ((rotation + 90) % 360) as 0 | 90 | 180 | 270;
                setRotation(next);
                setLocalPreview(await phonePreview(file, next));
              })
            }
          >
            {es ? "Girar foto" : "Rotate photo"}
          </button>
          <button
            disabled={busy}
            onClick={() =>
              work(async () => {
                const original = await fileBase64(file);
                const result = await callAction(
                  "inspect_document",
                  { data: original, rotation, acceptQuality: false },
                  { method: "POST", uiOnly: true },
                );
                setChecked({ ...result, original } as Checked);
              })
            }
          >
            {busy
              ? es
                ? "Revisando…"
                : "Checking…"
              : es
                ? "Revisar archivo"
                : "Check file"}
          </button>
        </div>
      )}
      {checked && (
        <>
          <DocumentView document={checked} es={es} />
          {(checked.quality?.dark || checked.quality?.blurry) && (
            <div role="alert">
              <p>
                {es
                  ? "La foto puede estar oscura o borrosa. Toma otra con buena luz, sin mover el teléfono. Revisa que puedas leer cada dato."
                  : "This photo may be dark or blurry. Retake it in good light and hold your phone still. Check that you can read each fact."}
              </p>
              <label className="choice">
                <input
                  type="checkbox"
                  checked={acceptQuality}
                  onChange={(event) => setAcceptQuality(event.target.checked)}
                />
                {es
                  ? "Puedo leer los datos en esta foto"
                  : "I can read the facts in this photo"}
              </label>
            </div>
          )}
          <div className="actions">
            <button
              disabled={
                busy ||
                (!!(checked.quality?.dark || checked.quality?.blurry) &&
                  !acceptQuality)
              }
              onClick={() =>
                work(async () => {
                  const result = await callAction(
                    "upload_document",
                    { data: checked.original, rotation, acceptQuality },
                    { method: "POST", uiOnly: true },
                  );
                  await onSaved(result.id);
                  setSmallerSaved(smaller);
                  setSmaller(false);
                  setFile(null);
                  setChecked(null);
                  setLocalPreview(null);
                  setCovered(false);
                })
              }
            >
              {busy
                ? es
                  ? "Guardando…"
                  : "Saving…"
                : es
                  ? "Guardar archivo privado"
                  : "Save private file"}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setFile(null);
                setChecked(null);
                setLocalPreview(null);
                setAcceptQuality(false);
              }}
            >
              {es
                ? "Tomar otra o elegir otro archivo"
                : "Retake or choose another file"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
