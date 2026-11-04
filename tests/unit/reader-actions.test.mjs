import assert from "node:assert/strict";
import test from "node:test";

import extractEvidence from "../../actions/extract_evidence.ts";

test("extract_evidence: signed-in POST, member's own agent only, no MCP, no recorded inputs", () => {
  assert.equal(extractEvidence.requiresAuth, true);
  assert.equal(extractEvidence.agentTool, true);
  assert.equal(extractEvidence.mcpTool, false);
  assert.equal(extractEvidence.http.method, "POST");
  assert.equal(extractEvidence.audit?.recordInputs, false);
});

test("try_read_document: signed out, upload size limit, no agent or MCP, no recorded inputs", async () => {
  const { default: tryRead } =
    await import("../../actions/try_read_document.ts");
  const { MAX_UPLOAD_REQUEST_BYTES } =
    await import("../../shared/document-upload.ts");
  assert.equal(tryRead.requiresAuth, false);
  assert.equal(tryRead.agentTool, false);
  assert.equal(tryRead.mcpTool, false);
  assert.equal(tryRead.maxBodyBytes, MAX_UPLOAD_REQUEST_BYTES);
  assert.equal(tryRead.http.method, "POST");
  assert.equal(tryRead.audit?.recordInputs, false);
});
