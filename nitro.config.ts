import { readdir, readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

type TracedPackages = Record<
  string,
  {
    name: string;
    versions: Record<
      string,
      {
        path: string;
        files: string[];
        pkgJSON: { optionalDependencies?: Record<string, string> };
      }
    >;
  }
>;

async function packageFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { recursive: true })) {
    if (entry.split("/").includes("node_modules")) continue;
    const path = join(root, entry);
    if ((await stat(path)).isFile()) files.push(path);
  }
  return files;
}

// The PDF page renderer loads its native canvas from a platform package that
// is an optional dependency. Copy the one installed for this build's platform.
async function addNativeBindings(packages: TracedPackages) {
  for (const name of ["@napi-rs/canvas"]) {
    for (const version of Object.values(packages[name]?.versions ?? {})) {
      const require = createRequire(join(version.path, "package.json"));
      for (const dependency of Object.keys(
        version.pkgJSON.optionalDependencies ?? {},
      )) {
        if (packages[dependency]) continue;
        let manifest: string;
        try {
          manifest = require.resolve(`${dependency}/package.json`);
        } catch {
          continue; // Not installed for this platform.
        }
        const pkgJSON = JSON.parse(await readFile(manifest, "utf8"));
        packages[dependency] = {
          name: dependency,
          versions: {
            [pkgJSON.version]: {
              path: dirname(manifest),
              files: await packageFiles(dirname(manifest)),
              pkgJSON,
            },
          },
        };
      }
    }
  }
}

export default {
  // Keep the HTTP safety checker, the CommonJS photo decoder and the PDF page
  // renderer (with its fonts and native canvas) intact at runtime.
  traceDeps: ["undici*", "libheif-js*", "pdfjs-dist*", "@napi-rs/canvas"],
  traceOpts: { hooks: { tracedPackages: addNativeBindings } },
};
