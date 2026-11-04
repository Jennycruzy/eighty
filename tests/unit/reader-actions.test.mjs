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
