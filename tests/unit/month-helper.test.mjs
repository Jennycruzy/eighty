import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  prepareDatabase,
  openExample,
  realMember,
  as,
  siteHeaders,
} from "../helpers/example-database.mjs";

const sql = await prepareDatabase();
const require = createRequire(import.meta.url);
const core = dirname(require.resolve("@agent-native/core/server"));
const { executeAgentToolCall } = await import(
  pathToFileURL(join(core, "../agent/production-agent.js")).href
);
const { loadActionsFromStaticRegistry } =
  await import("@agent-native/core/server");
const { handleMcpFetchRequest } = await import("@agent-native/core/mcp");
const refused = [
  "confirm_evidence",
  "edit_evidence",
  "reject_evidence",
  "save_coverage_answer",
  "add_manual_evidence",
  "inspect_document",
  "upload_document",
  "remove_document",
  "prepare_member_account",
  "finish_member_account",
];
const modules = Object.fromEntries(
  await Promise.all(
    refused.map(async (name) => [
      name,
      await import(`../../actions/${name}.ts`),
    ]),
  ),
);
const actions = loadActionsFromStaticRegistry(modules);
for (const name of refused) {
  test(`The agent tool route refuses ${name}`, async () => {
    const result = await executeAgentToolCall({
      actions,
      name,
      input: {},
      callId: name,
      caller: "tool",
      ownerEmail: "member@example.test",
    });
    assert.equal(result.status, "failed");
    assert.match(result.output, /Unknown or unavailable tool/);
  });
  test(`The MCP request refuses ${name}`, async () => {
    const response = await handleMcpFetchRequest(
      new Request("http://localhost/_agent-native/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: {} },
        }),
      }),
      {
        name: "eighty",
        description: "Member proof",
        actions,
        builtinCrossAppTools: false,
      },
      {
        identity: { ownerEmail: "member@example.test" },
        requestMeta: { fullSurface: true },
      },
    );
    const body = await response.text();
    assert.match(body, /Unknown tool|not found|not available|unavailable/i);
  });
}
const evidence = await import("../../server/lib/evidence-records.ts");
const example = await openExample("maria", "198.51.100.222");
const member = await realMember("helper-member@example.test");
test("The helper saves one proposed line through typed entry code, with the agent as its creator", async () => {
  const action = (await import("../../actions/propose_evidence.ts")).default;
  const fields = {
    kind: "service",
    organization: "Library book sale",
    start: "2026-10-31",
    end: "2026-10-31",
    hours: 4,
  };
  for (const account of [example, member]) {
    const before = await as(account, () =>
      evidence.listEvidenceRecords(account.context),
    );
    const saved = await as(account, () =>
      action.run({ fields }, { ...account.context, caller: "tool" }),
    );
    assert.equal(saved.status, "proposed");
    assert.equal(saved.createdBy, "agent");
    assert.deepEqual(saved.fields, fields);
    const after = await as(account, () =>
      evidence.listEvidenceRecords(account.context),
    );
    assert.equal(after.length, before.length + 1);
    const history = await sql.execute({
      sql: "SELECT status, created_by FROM eighty_evidence_versions WHERE evidence_id = ?",
      args: [saved.id],
    });
    assert.deepEqual(history.rows, [
      { status: "proposed", created_by: "agent" },
    ]);
  }
  for (const extra of [
    { status: "confirmed" },
    { ownerEmail: member.email },
    { createdBy: "member" },
  ])
    assert.equal(action.schema.safeParse({ fields, ...extra }).success, false);
});
test("Rosa's live-in family care explanation has the exact paragraph", async () => {
  const { EXAMPLE_PROFILES } =
    await import("../../server/lib/example-people.ts");
  const { assessExampleMonths } =
    await import("../../server/lib/example-month.ts");
  const result = assessExampleMonths(
    EXAMPLE_PROFILES.rosa.facts,
    [],
    "2026-11-06",
  ).thisMonth;
  assert.equal(result.citation, "42 CFR 435.554(c)(3)(i)(A)");
  assert.match(result.explanation, /depends on your regular help/);
  assert.match(result.explanationEs, /ayuda habitual/);
});
test("Try reads, example reads and example turns share 50 uses; the 51st is refused", async () => {
  const { reserveDailyTry, PUBLIC_HELPER_REST } =
    await import("../../server/lib/try-reading.ts");
  for (let index = 0; index < 50; index++)
    assert(
      await reserveDailyTry(
        50,
        ["try_read_document", "extract_evidence", "example_agent_turn"][
          index % 3
        ],
      ),
    );
  assert.equal(await reserveDailyTry(50, "example_agent_turn"), null);
  assert.equal(
    PUBLIC_HELPER_REST,
    "The example helper is resting until tomorrow. You can still look around and type lines yourself.",
  );
  const rows = await sql.execute(
    "SELECT count(*)::int AS n FROM eighty_ai_ledger WHERE purpose = 'try'",
  );
  assert.equal(rows.rows[0].n, 50);
});
test("An example turn is counted in the ledger; a signed-in member turn does not use that count", async () => {
  const middleware = (await import("../../server/middleware/auth.ts")).default;
  const { H3Event } = await import("h3");
  await sql.execute("DELETE FROM eighty_ai_ledger");
  const call = (account) =>
    middleware(
      new H3Event(
        new Request("http://localhost:3000/_agent-native/month-helper", {
          method: "POST",
          headers: siteHeaders("203.0.113.240", { cookie: account.cookie }),
          body: "{}",
        }),
      ),
    );
  await call(example);
  let rows = await sql.execute("SELECT action, purpose FROM eighty_ai_ledger");
  assert.deepEqual(rows.rows, [
    { action: "example_agent_turn", purpose: "try" },
  ]);
  await call(member);
  rows = await sql.execute("SELECT count(*)::int AS n FROM eighty_ai_ledger");
  assert.equal(rows.rows[0].n, 1);
  await sql.execute(
    "INSERT INTO eighty_ai_ledger (id, purpose, action) SELECT gen_random_uuid(), 'try', 'try_read_document' FROM generate_series(1,49)",
  );
  await assert.rejects(call(example), {
    statusCode: 429,
    statusMessage:
      "The example helper is resting until tomorrow. You can still look around and type lines yourself.",
  });
  await call(member);
});
test("Verification mail is limited to three an hour per address and renews the carried answers", async () => {
  const {
    takeVerificationMail,
    renewRegistrationDraft,
    registrationAddressHash,
  } = await import("../../server/lib/registration.ts");
  const { encryptSecretValue, decryptSecretValue } =
    await import("@agent-native/core/secrets/crypto");
  const email = "waiting@example.test";
  for (let n = 0; n < 3; n++) assert(await takeVerificationMail(email));
  assert.equal(await takeVerificationMail(email), undefined);
  assert(await takeVerificationMail("another@example.test"));
  await sql.execute({
    sql: "UPDATE eighty_registration_mail SET window_start = now() - interval '61 minutes' WHERE address_hash = ?",
    args: [registrationAddressHash(email)],
  });
  assert(await takeVerificationMail(email));
  const profile = { language: "es-US", screener: { state: "NE", age: "34" } };
  const old = encryptSecretValue(
    JSON.stringify({
      email,
      consent: true,
      profile,
      purpose: "screener-account",
      expires: Date.now() - 1,
    }),
  );
  const renewed = JSON.parse(
    decryptSecretValue(renewRegistrationDraft(old, email)),
  );
  assert.deepEqual(renewed.profile, profile);
  assert(renewed.expires >= Date.now() + 24 * 60 * 60 * 1000 - 2000);
  assert.equal(renewRegistrationDraft(old, "other@example.test"), null);
});
test("Verification email says 24 hours and shows its header name once", async () => {
  await import("../../server/plugins/agent-native-email-branding.ts");
  const templates = await import(
    pathToFileURL(join(core, "../email-catalog/templates.js")).href
  );
  const message = await templates.renderTransactionalEmail(
    "core.verify-signup",
    {
      email: "waiting@example.test",
      verifyUrl: "https://eighty.example.test/verify",
    },
  );
  assert.match(message.text, /This link works for 24 hours\./);
  assert.doesNotMatch(message.html, /alt="Eighty"/);
});

test("The member's authenticated tool runner can read the example month without browser headers", async () => {
  const registry = loadActionsFromStaticRegistry({
    example_month: await import("../../actions/example_month.ts"),
    list_evidence: await import("../../actions/list_evidence.ts"),
  });
  for (const name of ["example_month", "list_evidence"]) {
    const result = await as(example, () =>
      executeAgentToolCall({
        actions: registry,
        name,
        input: {},
        callId: name,
        caller: "tool",
        ownerEmail: example.email,
      }),
    );
    assert.equal(result.status, "completed", result.output);
    assert.match(result.output, name === "example_month" ? /61/ : /proposed/);
  }
});

test("A signed-in member's try read uses none of the public daily count", async () => {
  const { tryReadDocument } = await import("../../server/lib/try-reading.ts");
  const { exampleSamplePdf } =
    await import("../../server/lib/example-sample.ts");
  const before = (
    await sql.execute(
      "SELECT count(*)::int AS n FROM eighty_ai_ledger WHERE purpose = 'try'",
    )
  ).rows[0].n;
  const data = Buffer.from(await exampleSamplePdf("2026-11-06")).toString(
    "base64",
  );
  const answer = await as(member, () =>
    tryReadDocument(
      { data, rotation: 0, language: "en" },
      {
        ...member.context,
        requestHeaders: siteHeaders("198.51.100.252", {
          cookie: member.cookie,
        }),
      },
    ),
  );
  assert.equal(answer.outcome, "unavailable");
  const after = (
    await sql.execute(
      "SELECT count(*)::int AS n FROM eighty_ai_ledger WHERE purpose = 'try'",
    )
  ).rows[0].n;
  assert.equal(after, before);
});

test("A different exclusion keeps its own citation when care facts are also present", async () => {
  const { EXAMPLE_PROFILES } =
    await import("../../server/lib/example-people.ts");
  const { monthExplanation } =
    await import("../../server/lib/month-explanation.ts");
  assert.deepEqual(
    monthExplanation(EXAMPLE_PROFILES.rosa.facts, {
      status: "Exempt",
      citation: "42 CFR 435.554(c)(4)",
      basis: "Another exclusion",
    }),
    { citation: "42 CFR 435.554(c)(4)" },
  );
});
