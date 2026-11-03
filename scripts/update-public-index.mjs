import { readFile, writeFile } from "node:fs/promises";

import { PUBLIC_PAGES } from "../shared/access.ts";
// Set the final HTTPS origin here when its DNS is ready, then regenerate the files.
const origin = "https://38.49.219.205.sslip.io";
const states = JSON.parse(
  await readFile(new URL("../data/states.json", import.meta.url), "utf8"),
);
const paths = [
  ...PUBLIC_PAGES,
  ...states.map((state) => `/states/${state.code.toLowerCase()}`),
];
const addresses = paths.flatMap((path) => [path, `${path}?lang=es`]);
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${addresses.map((path) => `  <url><loc>${escape(origin + path)}</loc></url>`).join("\n")}\n</urlset>\n`;
const robots = `User-agent: *\nDisallow: /\n${addresses.map((path) => `Allow: ${path}$`).join("\n")}\nAllow: /assets/\nAllow: /favicon.svg$\nAllow: /icon-180.svg$\nAllow: /robots.txt$\nAllow: /sitemap.xml$\n\nSitemap: ${origin}/sitemap.xml\n`;
await writeFile(new URL("../public/sitemap.xml", import.meta.url), sitemap);
await writeFile(new URL("../public/robots.txt", import.meta.url), robots);
console.log(`Updated public search files with ${addresses.length} addresses.`);
