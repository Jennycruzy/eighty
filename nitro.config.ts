export default {
  // Keep the HTTP safety checker, the CommonJS photo decoder and the PDF page
  // renderer (with its fonts and native canvas) intact at runtime.
  traceDeps: ["undici*", "libheif-js*", "pdfjs-dist*", "@napi-rs/canvas*"],
};
