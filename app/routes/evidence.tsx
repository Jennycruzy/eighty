import { callAction } from "@agent-native/core/client/hooks";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";

import { type EvidenceFields } from "../../shared/evidence";
import { type DuplicateChoice } from "../../shared/evidence-review";
import { DemoSample } from "../components/demo/DemoSample";
import {
  DocumentView,
  type DocumentData,
} from "../components/evidence/DocumentView";
import { EvidenceForm } from "../components/evidence/EvidenceForm";
import { fieldsFor, getField, kinds } from "../components/evidence/fields";
import { UploadProof } from "../components/evidence/UploadProof";
import { useLanguage, languageLink } from "../lib/language";

export function headers() {
  return {
    "x-agent-native-ssr-max-age": "0",
    "Cache-Control": "private, no-store",
  };
}
interface Line {
  id: string;
  version: number;
  status: "proposed" | "confirmed" | "rejected";
  fields: EvidenceFields;
  documentId: string | null;
}
interface FileRow {
  id: string;
  mime: string;
  pages: number | null;
  bytes: number;
}
export default function Evidence() {
  const reviewMode = useLocation().pathname === "/review";
  const lang = useLanguage(),
    es = lang === "es",
    link = (path: string) => languageLink(path, lang);
  const [lines, setLines] = useState<Line[]>([]),
    [files, setFiles] = useState<FileRow[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Line | "new" | null>(null),
    [documentId, setDocumentId] = useState(""),
    [view, setView] = useState<DocumentData | null>(null);
  const [duplicate, setDuplicate] = useState<{
    id: string;
    version: number;
    compared: DuplicateChoice["compared"];
  } | null>(null);
  async function refresh() {
    const [nextLines, nextFiles] = await Promise.all([
      callAction("list_evidence", {}, { method: "GET" }),
      callAction("list_documents", {}, { method: "GET" }),
    ]);
    setLines(nextLines as Line[]);
    setFiles(nextFiles as FileRow[]);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      callAction("list_evidence", {}, { method: "GET" }),
      callAction("list_documents", {}, { method: "GET" }),
    ])
      .then(([a, b]) => {
        if (active) {
          setLines(a as Line[]);
          setFiles(b as FileRow[]);
        }
      })
      .catch(() => {
        if (active) setError("load");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function work(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch {
      setError("save");
    } finally {
      setBusy(false);
    }
  }
  async function confirm(
    line: Pick<Line, "id" | "version">,
    choice?: DuplicateChoice,
  ) {
    await work(async () => {
      try {
        await callAction(
          "confirm_evidence",
          {
            id: line.id,
            version: line.version,
            ...(choice ? { duplicateChoice: choice } : {}),
          },
          { method: "POST", uiOnly: true },
        );
        setDuplicate(null);
        await refresh();
        setNotice("confirmed");
      } catch (failure) {
        const details = (
          failure as { details?: { compared?: DuplicateChoice["compared"] } }
        ).details;
        if (details?.compared?.length) {
          setDuplicate({ ...line, compared: details.compared });
          await refresh();
          return;
        }
        throw failure;
      }
    });
  }
  function summary(fields: EvidenceFields) {
    return (
      <dl>
        {fieldsFor(fields.kind)
          .filter((field) => getField(fields, field.path) != null)
          .map((field) => {
            const raw = getField(fields, field.path);
            const value =
              typeof raw === "boolean"
                ? raw
                  ? es
                    ? "Sí"
                    : "Yes"
                  : "No"
                : field.type === "money"
                  ? `$${(Number(raw) / 100).toFixed(2)}`
                  : field.options?.find((option) => option[0] === raw)?.[
                      es ? 2 : 1
                    ] || String(raw);
            return (
              <div key={field.path}>
                <dt>{es ? field.es : field.en}</dt>
                <dd>{value}</dd>
              </div>
            );
          })}
      </dl>
    );
  }
  return (
    <>
      <h1>
        {reviewMode
          ? es
            ? "Revisar mis pruebas"
            : "Review my proof"
          : es
            ? "Mis pruebas"
            : "My proof"}
      </h1>
      <nav aria-label={es ? "Mis pruebas" : "My proof"}>
        <Link to={link("/add")}>{es ? "Añadir" : "Add proof"}</Link>
        <Link to={link("/review")}>{es ? "Revisar" : "Review proof"}</Link>
        <button
          className="secondary"
          disabled={busy}
          onClick={() =>
            work(async () => {
              const response = await fetch("/_agent-native/auth/ba/sign-out", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
              });
              if (!response.ok) throw new Error();
              window.location.assign(link("/check/sign-in"));
            })
          }
        >
          {es ? "Salir" : "Sign out"}
        </button>
      </nav>
      <p>
        {es
          ? "Solo tú puedes ver estos archivos. Una línea no cuenta hasta que la confirmes. Confirmar los datos no decide si tu mes cumple la regla."
          : "Only you can see these files. A line does not count until you confirm it. Confirming facts does not decide if your month meets the rule."}
      </p>
      <p>
        {es
          ? "Escribe los datos a mano. Aquí no se usa un lector de IA."
          : "Type the facts by hand. No AI reader is used here."}
      </p>
      {loading && (
        <p role="status">
          {es ? "Cargando tus pruebas…" : "Loading your proof…"}
        </p>
      )}
      {error && (
        <section role="alert">
          <p>
            {es
              ? "No se pudo terminar. Revisa tu conexión y que tu correo esté verificado. Si la prueba cambió, vuelve a cargarla. Para confirmar, añade las fechas, la organización y la fecha de pago si aplica."
              : "We could not finish. Check your connection and that your email is verified. If the proof changed, load it again. To confirm, add dates, the group or employer, and the pay date if there is pay."}
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              work(async () => {
                await refresh();
                setLoading(false);
              })
            }
          >
            {es ? "Volver a cargar" : "Load again"}
          </button>
          <p>
            <Link to={link("/check/sign-in")}>{es ? "Entrar" : "Sign in"}</Link>
          </p>
        </section>
      )}
      {notice && (
        <p role="status">
          {notice === "delete-pending"
            ? es
              ? "Quitamos el archivo de tu lista. Estamos borrando la copia guardada. Se intentará de nuevo si hace falta."
              : "The file is off your list. We are deleting the stored copy. We will retry if needed."
            : notice === "deleted"
              ? es
                ? "Archivo borrado."
                : "File deleted."
              : notice === "confirmed"
                ? es
                  ? "Confirmaste los datos de esta línea."
                  : "You confirmed this line’s facts."
                : es
                  ? "Guardado."
                  : "Saved."}
        </p>
      )}
      {!loading && error !== "load" && (
        <>
          {!reviewMode && (
            <DemoSample
              busy={busy}
              work={work}
              onSaved={async (id) => {
                setDocumentId(id);
                setEditing("new");
                await refresh();
              }}
            />
          )}
          {!reviewMode && (
            <UploadProof
              es={es}
              busy={busy}
              work={work}
              onSaved={async (id) => {
                setDocumentId(id);
                setEditing("new");
                setNotice("saved");
                await refresh();
              }}
            />
          )}
          {(!reviewMode || editing) && (
            <section className="card">
              <h2>{es ? "Escribir una prueba" : "Type a proof line"}</h2>
              {!editing && (
                <button
                  disabled={busy}
                  onClick={() => {
                    setDocumentId("");
                    setEditing("new");
                  }}
                >
                  {es ? "Escribir los datos" : "Type the facts"}
                </button>
              )}
              {editing && (
                <>
                  <label>
                    {es
                      ? "Archivo que respalda la línea"
                      : "File that backs this line"}
                    <select
                      value={documentId}
                      aria-label={
                        es
                          ? "Archivo que respalda la línea"
                          : "File that backs this line"
                      }
                      disabled={editing !== "new"}
                      onChange={(event) => setDocumentId(event.target.value)}
                    >
                      <option value="">{es ? "Sin archivo" : "No file"}</option>
                      {files.map((row, i) => (
                        <option key={row.id} value={row.id}>
                          {es ? "Archivo" : "File"} {i + 1} · {row.pages || 1}{" "}
                          {es ? "página(s)" : "page(s)"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <EvidenceForm
                    key={
                      editing === "new"
                        ? "new"
                        : `${editing.id}-${editing.version}`
                    }
                    initial={editing === "new" ? undefined : editing.fields}
                    es={es}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={async (fields) => {
                      await work(async () => {
                        if (editing === "new")
                          await callAction(
                            "add_manual_evidence",
                            { fields, ...(documentId ? { documentId } : {}) },
                            { method: "POST", uiOnly: true },
                          );
                        else if (editing)
                          await callAction(
                            "edit_evidence",
                            {
                              id: editing.id,
                              version: editing.version,
                              fields,
                            },
                            { method: "POST", uiOnly: true },
                          );
                        setEditing(null);
                        setDuplicate(null);
                        await refresh();
                        setNotice("saved");
                      });
                    }}
                  />
                </>
              )}
            </section>
          )}
          <section>
            <h2>{es ? "Revisar las líneas" : "Review the lines"}</h2>
            {!lines.length && (
              <p>
                {es
                  ? reviewMode
                    ? "Aún no hay líneas. Elige Añadir para escribir una."
                    : "Aún no hay líneas. Escribe una arriba, con o sin archivo."
                  : reviewMode
                    ? "No proof lines yet. Choose Add proof to enter a line."
                    : "No proof lines yet. Type one above, with or without a file."}
              </p>
            )}
            {lines.map((line, index) => (
              <article
                className="card evidence-line"
                key={line.id}
                aria-label={`${es ? "Línea" : "Line"} ${index + 1}`}
              >
                <h3>
                  {index + 1}.{" "}
                  {kinds.find((k) => k[0] === line.fields.kind)?.[es ? 2 : 1]}
                </h3>
                <p>
                  <strong>
                    {line.status === "confirmed"
                      ? es
                        ? "Datos confirmados"
                        : "Facts confirmed"
                      : line.status === "rejected"
                        ? es
                          ? "Rechazada; no cuenta"
                          : "Rejected; does not count"
                        : es
                          ? "Por revisar; no cuenta"
                          : "Needs review; does not count"}
                  </strong>
                </p>
                {summary(line.fields)}
                <div className="actions">
                  {line.documentId && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        work(async () => {
                          setView(
                            (await callAction(
                              "get_document",
                              { id: line.documentId! },
                              { method: "GET" },
                            )) as DocumentData,
                          );
                        })
                      }
                    >
                      {es ? "Ver archivo" : "View file"}
                    </button>
                  )}
                  {line.status === "proposed" && (
                    <button disabled={busy} onClick={() => confirm(line)}>
                      {es ? "Confirmar los datos" : "Confirm facts"}
                    </button>
                  )}
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setEditing(line);
                      setDocumentId(line.documentId || "");
                    }}
                  >
                    {line.status === "rejected"
                      ? es
                        ? "Restaurar y editar"
                        : "Restore and edit"
                      : es
                        ? "Editar"
                        : "Edit"}
                  </button>
                  {line.status !== "rejected" && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        work(async () => {
                          await callAction(
                            "reject_evidence",
                            { id: line.id, version: line.version },
                            { method: "POST", uiOnly: true },
                          );
                          setDuplicate(null);
                          await refresh();
                        })
                      }
                    >
                      {es ? "Rechazar" : "Reject"}
                    </button>
                  )}
                </div>
                {duplicate?.id === line.id && (
                  <section role="alert">
                    <h4>
                      {es ? "Puede estar repetida" : "This may be a repeat"}
                    </h4>
                    <p>
                      {es
                        ? "Compara estas líneas. Confirma solo si cada una es una actividad o un pago distinto."
                        : "Compare these lines. Confirm only if each is a separate activity or pay item."}
                    </p>
                    {duplicate.compared.map((reference) => {
                      const other = lines.find(
                        (row) => row.id === reference.id,
                      );
                      return other ? (
                        <div key={other.id}>
                          <h5>
                            {es
                              ? "Otra línea confirmada"
                              : "Other confirmed line"}
                          </h5>
                          {summary(other.fields)}
                        </div>
                      ) : (
                        <p key={reference.id}>
                          {es
                            ? "La otra línea cambió. Vuelve a cargarla."
                            : "The other line changed. Load it again."}
                        </p>
                      );
                    })}
                    <button
                      disabled={busy}
                      onClick={() =>
                        confirm(duplicate, {
                          choice: "these-are-separate",
                          compared: duplicate.compared,
                        })
                      }
                    >
                      {es ? "Estas son distintas" : "These are separate"}
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setDuplicate(null)}
                    >
                      {es
                        ? "Volver sin confirmar"
                        : "Go back without confirming"}
                    </button>
                  </section>
                )}
              </article>
            ))}
          </section>
          <section>
            <h2>{es ? "Mis archivos privados" : "My private files"}</h2>
            {!files.length && (
              <p>{es ? "Aún no hay archivos." : "No files yet."}</p>
            )}
            {files.map((row, i) => (
              <div className="card" key={row.id}>
                <p>
                  {es ? "Archivo" : "File"} {i + 1} · {row.pages || 1}{" "}
                  {es ? "página(s)" : "page(s)"} ·{" "}
                  {(row.bytes / 1024 / 1024).toFixed(2)} MB
                </p>
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                      work(async () =>
                        setView(
                          (await callAction(
                            "get_document",
                            { id: row.id },
                            { method: "GET" },
                          )) as DocumentData,
                        ),
                      )
                    }
                  >
                    {es ? "Ver archivo" : "View file"}
                  </button>
                  {!lines.some(
                    (line) =>
                      line.documentId === row.id && line.status !== "rejected",
                  ) && (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        work(async () => {
                          const removal = await callAction(
                            "remove_document",
                            { id: row.id },
                            { method: "POST", uiOnly: true },
                          );
                          setView(null);
                          await refresh();
                          setNotice(
                            removal.pending ? "delete-pending" : "deleted",
                          );
                        })
                      }
                    >
                      {es ? "Borrar archivo sin uso" : "Delete unused file"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>
        </>
      )}
      {view && (
        <section className="card">
          <h2>{es ? "Tu archivo privado" : "Your private file"}</h2>
          <button className="secondary" onClick={() => setView(null)}>
            {es ? "Cerrar archivo" : "Close file"}
          </button>
          <DocumentView document={view} es={es} />
        </section>
      )}
      <p>
        {es
          ? "Editar una línea confirmada quita su confirmación. Revísala y confírmala de nuevo. Puedes restaurar una línea rechazada al editarla."
          : "Editing a confirmed line removes its confirmation. Review and confirm it again. You can restore a rejected line by editing it."}
      </p>
    </>
  );
}
