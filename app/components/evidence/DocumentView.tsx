import { useEffect, useRef, useState } from "react";
export interface DocumentData {
  original: string;
  preview: string | null;
  mime: string;
  pages: number;
  quality: { dark: boolean; blurry: boolean } | null;
}
export function DocumentView({
  document,
  es,
}: {
  document: DocumentData;
  es: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [page, setPage] = useState(1),
    [rotation, setRotation] = useState(0),
    [zoom, setZoom] = useState(1),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(false);
  const pdf = document.mime === "application/pdf";
  useEffect(() => {
    if (!pdf) return;
    let active = true,
      destroy: (() => Promise<void>) | undefined;
    setLoading(true);
    setError(false);
    (async () => {
      const library = await import("pdfjs-dist");
      library.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).href;
      const task = library.getDocument({
        data: Uint8Array.from(atob(document.original), (c) => c.charCodeAt(0)),
        useSystemFonts: true,
      });
      destroy = () => task.destroy();
      const file = await task.promise;
      if (!active || !canvas.current) return;
      const sheet = await file.getPage(page);
      const base = sheet.getViewport({ scale: 1, rotation });
      const viewport = sheet.getViewport({
        scale:
          Math.min(
            1600,
            Math.max(280, canvas.current.parentElement!.clientWidth) * zoom,
          ) / base.width,
        rotation,
      });
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      await sheet.render({ canvas: canvas.current, viewport }).promise;
      if (active) setLoading(false);
    })().catch(() => {
      if (active) {
        setError(true);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      void destroy?.();
    };
  }, [document, page, rotation, zoom, pdf]);
  function download() {
    const blob = new Blob(
      [Uint8Array.from(atob(document.original), (c) => c.charCodeAt(0))],
      { type: document.mime },
    );
    const url = URL.createObjectURL(blob),
      link = window.document.createElement("a");
    link.href = url;
    link.download = `proof.${pdf ? "pdf" : document.mime === "image/heic" ? "heic" : document.mime.split("/")[1]}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section aria-label={es ? "Tu archivo" : "Your file"}>
      <div className="document-view">
        {pdf ? (
          <canvas
            ref={canvas}
            aria-label={
              es
                ? `Página ${page} de ${document.pages}`
                : `Page ${page} of ${document.pages}`
            }
          />
        ) : (
          <img
            src={`data:image/jpeg;base64,${document.preview}`}
            alt={
              es
                ? "Tu foto. Copia los datos en el formulario."
                : "Your photo. Type its facts in the form."
            }
          />
        )}
      </div>
      <p role="status">
        {loading
          ? es
            ? "Abriendo página…"
            : "Opening page…"
          : pdf
            ? es
              ? `Página ${page} de ${document.pages}`
              : `Page ${page} of ${document.pages}`
            : ""}
      </p>
      {error && (
        <p role="alert">
          {es
            ? "No pudimos mostrar la página. Descarga el original para leerlo."
            : "We could not show this page. Download the original to read it."}
        </p>
      )}
      <div className="actions">
        {pdf && (
          <>
            <button
              type="button"
              className="secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {es ? "Página anterior" : "Previous page"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={page >= document.pages}
              onClick={() => setPage(page + 1)}
            >
              {es ? "Página siguiente" : "Next page"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setRotation((rotation + 90) % 360)}
            >
              {es ? "Girar página" : "Rotate page"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setZoom(zoom === 1 ? 2 : 1)}
            >
              {es ? "Cambiar tamaño" : "Change size"}
            </button>
          </>
        )}
        <button type="button" className="secondary" onClick={download}>
          {es ? "Descargar archivo guardado" : "Download saved file"}
        </button>
      </div>
    </section>
  );
}
