export default {
  // Keep the HTTP safety checker and the CommonJS photo decoder intact at runtime.
  traceDeps: ["undici*", "libheif-js*"],
};
