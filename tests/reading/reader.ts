// The one place the test set reaches the document reader.
// The reader is server/lib/reader.ts, the same code the app runs. If that file is missing, loadReader()
// stops with a plain message instead of running anything.
// Contract:
//   readDocument(input: { bytes: Uint8Array; mime: string; language?: "en" | "es" })
//     : Promise<{ result: ReaderResult; usage: { inputTokens: number | null; outputTokens: number | null } }>
import { fileURLToPath } from "node:url";

import type { ReaderResult } from "../../shared/evidence.ts";

export interface ReadDocumentInput {
  bytes: Uint8Array;
  mime: string;
  language?: "en" | "es";
}
export interface ReadDocumentOutput {
  result: ReaderResult;
  usage: { inputTokens: number | null; outputTokens: number | null };
}
export type ReadDocument = (input: ReadDocumentInput) => Promise<ReadDocumentOutput>;

export const READER_MODULE = new URL("../../server/lib/reader.ts", import.meta.url);

export async function loadReader(location: URL = READER_MODULE): Promise<ReadDocument> {
  let module: { readDocument?: unknown };
  try {
    module = await import(location.href);
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Only the reader file itself being absent gets the plain message; any other missing file is a real error.
    if (code === "ERR_MODULE_NOT_FOUND" && String((error as Error).message).includes(`'${fileURLToPath(location)}'`))
      throw new Error(
        "The document reader is missing: the runner loads server/lib/reader.ts.",
      );
    throw error;
  }
  if (typeof module.readDocument !== "function")
    throw new Error("server/lib/reader.ts must export readDocument(input).");
  const readDocument = module.readDocument as ReadDocument;
  const { runWithRequestContext } = await import("@agent-native/core/server");
  // The test reads as no member, like a signed-out visitor in try mode: use the deployment's model setting.
  return async (input) => runWithRequestContext({ defaultAgentEngineScope: "deployment" }, () => readDocument(input));
}
