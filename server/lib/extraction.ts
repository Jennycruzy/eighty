import type { ActionRunContext } from "@agent-native/core/action";
import { readPrivateBlob } from "@agent-native/core/private-blob";
import { z } from "zod";

import { MAX_READ_PAGES } from "../../shared/reader.ts";
import { recordReaderCall } from "./ai-ledger.ts";
import { ownDocumentRow } from "./document-records.ts";
import { readerLinesFor, saveReaderProposals } from "./evidence-records.ts";
import { memberActor } from "./member-identity.ts";
import { getMemberRecord } from "./member-records.ts";
import { readDocument, ReaderFailure } from "./reader.ts";

export const extractInput = z.strictObject({ documentId: z.uuid() });
export type ExtractOutcome =
  | "read"
  | "nothing-found"
  | "not-us-document"
  | "unreadable"
  | "unavailable";

const ACTION = "extract_evidence";

/**
 * Reads one of the signed-in member's documents into proposed lines. It never
 * confirms anything; the member checks every line. One ledger row per call.
 */
export async function extractEvidence(
  input: z.infer<typeof extractInput>,
  context: ActionRunContext | undefined,
) {
  const { documentId } = extractInput.parse(input);
  const actor = await memberActor(context);
  const member = await getMemberRecord(actor);
  const document = await ownDocumentRow(documentId, actor, member);
  const pages = {
    pages: document.pages ?? 1,
    pagesRead: Math.min(document.pages ?? 1, MAX_READ_PAGES),
  };
  const ledger = (usage: {
    inputTokens: number | null;
    outputTokens: number | null;
  }) =>
    recordReaderCall({
      memberId: member.id,
      action: ACTION,
      purpose: "extraction",
      usage,
    });
  const already = await readerLinesFor(actor, member, document.id);
  if (already.length) {
    // Read before: no model call, no new lines.
    await ledger({ inputTokens: 0, outputTokens: 0 });
    return {
      outcome: "read" as ExtractOutcome,
      lines: already,
      created: false,
      ...pages,
    };
  }
  const bytes = new Uint8Array((await readPrivateBlob(document.handle)).data);
  let reading;
  try {
    reading = await readDocument({
      bytes,
      mime: document.mime,
      language: member.language === "es-US" ? "es" : "en",
      rotation: document.rotation as 0 | 90 | 180 | 270,
    });
  } catch (error) {
    if (!(error instanceof ReaderFailure)) throw error;
    await ledger(error.usage);
    return {
      outcome: error.reason as ExtractOutcome,
      lines: [],
      created: false,
      ...pages,
    };
  } finally {
    bytes.fill(0);
  }
  await ledger(reading.usage);
  if (!reading.result.usDocument)
    return {
      outcome: "not-us-document" as ExtractOutcome,
      lines: [],
      created: false,
      ...pages,
    };
  const saved = await saveReaderProposals(
    actor,
    member,
    document.id,
    reading.result.proposals,
  );
  return {
    outcome: (saved.lines.length ? "read" : "nothing-found") as ExtractOutcome,
    lines: saved.lines,
    created: saved.created,
    ...pages,
  };
}
