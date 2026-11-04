import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import test from "node:test";

import {
  as,
  openDemo,
  prepareDatabase,
  realMember,
  siteHeaders,
} from "../helpers/demo-database.mjs";

const sql = await prepareDatabase();
const { H3Event } = await import("h3");
const demo = await import("../../server/lib/demo-accounts.ts");
const evidence = await import("../../server/lib/evidence-records.ts");
const files = await import("../../server/lib/document-records.ts");
const { getMemberRecord, realMembersOnly } =
  await import("../../server/lib/member-records.ts");
const { getDb } = await import("../../server/db/index.ts");
const { members } = await import("../../server/db/schema.ts");
const { mariaSampleFields } = await import("../../server/lib/demo-people.ts");
const middleware = (await import("../../server/middleware/auth.ts")).default;
const { isDemoAllowedRequest } = await import("../../shared/access.ts");

const rows = async (query, args = []) =>
  (await sql.execute({ sql: query, args })).rows;
const real = await realMember();
const realLine = await as(real, () =>
  evidence.createEvidenceDraft(
    {
      fields: {
        kind: "work",
        organization: "Real employer",
        start: "2026-10-01",
        end: "2026-10-07",
        hours: 30,
      },
    },
    real.context,
  ),
);
const realPdf = Buffer.from(
  await (
    await import("../../server/lib/demo-sample.ts")
  ).demoSamplePdf("2026-10-03"),
).toString("base64");
const realFile = await as(real, () =>
  files.saveDocument({ data: realPdf }, real.context),
);

test("start_demo gives every call its own new account and member", async () => {
  const first = await openDemo("maria", "198.51.100.1");
  const second = await openDemo("maria", "198.51.100.1");
  assert.notEqual(first.userId, second.userId);
  assert.notEqual(first.email, second.email);
  assert.match(first.email, /^demo-[0-9a-f-]{36}@demo\.eighty\.invalid$/);
  const a = await as(first, () => getMemberRecord(first));
  const b = await as(second, () => getMemberRecord(second));
  assert.notEqual(a.id, b.id);
  const linesA = await as(first, () =>
    evidence.listEvidenceRecords(first.context),
  );
  const linesB = await as(second, () =>
    evidence.listEvidenceRecords(second.context),
  );
  assert.equal(linesA.length, 5);
  assert.equal(linesB.length, 5);
  assert.ok(linesA.every((line) => line.memberId === a.id));
  assert.ok(linesB.every((line) => line.memberId === b.id));
  // A change in one copy never shows in the other.
  const waiting = linesA.find((line) => line.status === "proposed");
  await as(first, () =>
    evidence.changeEvidenceRecord(
      "reject",
      { id: waiting.id, version: waiting.version },
      first.context,
    ),
  );
  const after = await as(second, () =>
    evidence.listEvidenceRecords(second.context),
  );
  assert.equal(after.filter((line) => line.status === "proposed").length, 1);
  // Each account belongs to the one Demo organisation, as a plain member.
  const org = await rows(
    "SELECT org_id, role FROM org_members WHERE email IN (?, ?) ORDER BY email",
    [first.email, second.email],
  );
  assert.deepEqual(
    org.map((row) => [row.org_id, row.role]),
    [
      ["eighty-demo", "member"],
      ["eighty-demo", "member"],
    ],
  );
  const owners = await rows(
    "SELECT email, role FROM org_members WHERE org_id = 'eighty-demo' AND role <> 'member'",
  );
  assert.deepEqual(owners, [
    { email: "demo-host@eighty.invalid", role: "owner" },
  ]);
  // The session used to make the copy is gone; only the visitor's remains.
  const sessions = await rows("SELECT id FROM session WHERE user_id = ?", [
    first.userId,
  ]);
  assert.equal(sessions.length, 1);
});

test("Each start has the seed numbers through the real rules", async () => {
  for (const [person, status, hours] of [
    ["maria", "Short", 61],
    ["daniel", "Meets", 82.94],
    ["rosa", "Exempt", null],
  ]) {
    const visitor = await openDemo(person, `198.51.100.${hours ?? 99}`);
    const month = await as(visitor, () => demo.demoMonth(visitor.context));
    assert.equal(month.person, person);
    assert.equal(month.thisMonth.status, status);
    if (hours !== null) assert.equal(month.thisMonth.hours, hours);
    if (person === "rosa")
      assert.equal(month.thisMonth.citation, "42 CFR 435.554(c)(3)(i)(A)");
    if (person === "maria") {
      assert.equal(month.lastMonth.status, "Meets");
      assert.equal(month.waiting, 1);
    }
  }
});

test("Maria's sample is saved like any upload and makes the month Meets once confirmed", async () => {
  const visitor = await openDemo("maria", "198.51.100.20");
  const saved = await as(visitor, () => demo.addDemoSample(visitor.context));
  assert.equal(saved.mime, "application/pdf");
  assert.equal(saved.pages, 1);
  assert.equal(saved.existing, false);
  const again = await as(visitor, () => demo.addDemoSample(visitor.context));
  assert.equal(again.id, saved.id);
  assert.equal(again.existing, true);
  const read = await as(visitor, () =>
    files.readDocument(saved.id, visitor.context),
  );
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(Buffer.from(read.original, "base64"));
  assert.match(pdf.getTitle(), /SAMPLE - made up/);
  const line = await as(visitor, () =>
    evidence.createEvidenceDraft(
      {
        fields: mariaSampleFields(new Date().toISOString().slice(0, 10)),
        documentId: saved.id,
      },
      visitor.context,
    ),
  );
  const waiting = await as(visitor, () => demo.demoMonth(visitor.context));
  assert.equal(waiting.thisMonth.status, "Not sure yet");
  await as(visitor, () =>
    evidence.changeEvidenceRecord(
      "confirm",
      { id: line.id, version: line.version },
      visitor.context,
    ),
  );
  const month = await as(visitor, () => demo.demoMonth(visitor.context));
  assert.equal(month.thisMonth.status, "Meets");
  assert.equal(
    month.thisMonth.citation,
    "42 CFR 435.552(a)(6), (f)(2); 435.603(e)",
  );
  assert.equal(month.thisMonth.amountCents, 61785);
  // The sample is Maria's alone.
  const daniel = await openDemo("daniel", "198.51.100.21");
  await assert.rejects(
    as(daniel, () => demo.addDemoSample(daniel.context)),
    { statusCode: 409 },
  );
});

test("The per-visitor limit refuses the extra start, and the total limit holds", async () => {
  const two = { enabled: true, perVisitor: 2, total: 120 };
  await openDemo("rosa", "192.0.2.50", two);
  await openDemo("rosa", "192.0.2.50", two);
  await assert.rejects(openDemo("rosa", "192.0.2.50", two), {
    statusCode: 429,
    details: { retryAfterSeconds: 3600 },
  });
  // Another visitor is not affected.
  await openDemo("rosa", "192.0.2.51", two);
  const [{ n }] = await rows(
    "SELECT count(*)::int AS n FROM eighty_demo_accounts WHERE created_at > now() - interval '1 hour'",
  );
  await assert.rejects(
    openDemo("rosa", "192.0.2.99", { enabled: true, perVisitor: 5, total: n }),
    { statusCode: 429 },
  );
  await assert.rejects(
    openDemo("rosa", "192.0.2.60", {
      enabled: false,
      perVisitor: 5,
      total: 120,
    }),
    { statusCode: 503 },
  );
});

test("IPv6 addresses share a visitor limit within their /64 prefix", async () => {
  const key = (ip) => demo.visitorKey(siteHeaders(ip));
  assert.equal(
    key("2001:db8:1234:5678::1"),
    key("2001:0db8:1234:5678:abcd:ef01:2345:6789"),
  );
  assert.equal(key("::1"), key("0:0:0:0:0:0:0:2"));
  assert.equal(key("fe80::1%eth0"), key("fe80::2%eth1"));
  assert.equal(key("::ffff:192.0.2.1"), key("::ffff:c000:201"));
  assert.equal(key("::ffff:192.0.2.1"), key("192.0.2.1"));
  assert.notEqual(key("::ffff:192.0.2.1"), key("::ffff:192.0.2.2"));
  assert.equal(demo.visitorAddress("::ffff:c000:202"), "192.0.2.2");
  assert.equal(demo.visitorAddress("2001:db8::1"), "2001:0db8:0000:0000");
  assert.notEqual(key("2001:db8:1234:5678::1"), key("2001:db8:1234:5679::1"));
  assert.notEqual(key("192.0.2.1"), key("192.0.2.2"));
  const settings = { enabled: true, perVisitor: 1, total: 120 };
  await openDemo("rosa", "2001:db8:1234:5678::1", settings);
  await assert.rejects(openDemo("rosa", "2001:db8:1234:5678::2", settings), {
    statusCode: 429,
  });
  await openDemo("rosa", "2001:db8:1234:5679::1", settings);
});

test("Failed starts remove their account data and free both limits", async () => {
  const tables = [
    "eighty_demo_accounts",
    "user",
    "org_members",
    "session",
    "account",
    "eighty_members",
    "eighty_evidence",
    "eighty_evidence_versions",
    "eighty_member_events",
    "eighty_documents",
  ];
  const counts = async () =>
    Promise.all(
      tables.map(
        async (table) =>
          (await rows(`SELECT count(*)::int AS n FROM "${table}"`))[0].n,
      ),
    );
  let suffix = 230;
  for (const table of [
    "user",
    "org_members",
    "eighty_members",
    "eighty_evidence_versions",
  ]) {
    const ip = `192.0.2.${suffix++}`;
    const before = await counts();
    const [{ n }] = await rows(
      "SELECT count(*)::int AS n FROM eighty_demo_accounts WHERE created_at > now() - interval '1 hour'",
    );
    const settings = { enabled: true, perVisitor: 1, total: n + 1 };
    await sql.execute(
      `CREATE FUNCTION fail_demo_start() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Demo write refused'; END $$`,
    );
    const condition =
      table === "eighty_evidence_versions"
        ? "WHEN (NEW.fields->>'kind' = 'service')"
        : "";
    await sql.execute(
      `CREATE TRIGGER fail_demo_start BEFORE INSERT ON "${table}" FOR EACH ROW ${condition} EXECUTE FUNCTION fail_demo_start()`,
    );
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        await assert.rejects(openDemo("maria", ip, settings), (error) => {
          assert.match(
            String(error.cause?.message ?? error.message),
            /Demo write refused/,
          );
          return true;
        });
        assert.deepEqual(await counts(), before);
      }
    } finally {
      await sql.execute(`DROP TRIGGER fail_demo_start ON "${table}"`);
      await sql.execute("DROP FUNCTION fail_demo_start()");
    }
    await openDemo("maria", ip, settings);
  }
});

test("Demo settings are plain, with safe defaults for missing or wrong values", () => {
  const read = (values) => (key) => values[key];
  assert.deepEqual(demo.demoSettings(read({})), {
    enabled: true,
    perVisitor: 5,
    total: 120,
  });
  assert.deepEqual(
    demo.demoSettings(
      read({
        EIGHTY_DEMO_ENABLED: "0",
        EIGHTY_DEMO_STARTS_PER_VISITOR_HOUR: "3",
        EIGHTY_DEMO_STARTS_PER_HOUR: "40",
      }),
    ),
    { enabled: false, perVisitor: 3, total: 40 },
  );
  for (const wrong of ["lots", "0", "-1", "2.5", "999999"])
    assert.deepEqual(
      demo.demoSettings(
        read({
          EIGHTY_DEMO_STARTS_PER_VISITOR_HOUR: wrong,
          EIGHTY_DEMO_STARTS_PER_HOUR: wrong,
        }),
      ),
      { enabled: true, perVisitor: 5, total: 120 },
    );
});

test("A demo starts only from this site's pages, and a ticket works once", async () => {
  for (const headers of [
    siteHeaders("192.0.2.70", { origin: "https://elsewhere.example" }),
    siteHeaders("192.0.2.70", { "sec-fetch-site": "cross-site" }),
    new Headers({ host: "localhost:3000" }),
  ])
    await assert.rejects(
      demo.startDemo(
        { person: "maria" },
        { caller: "http", requestHeaders: headers },
      ),
      { statusCode: 403 },
    );
  const started = await demo.startDemo(
    { person: "maria" },
    { caller: "http", requestHeaders: siteHeaders("192.0.2.71") },
  );
  const enter = (ticket, headers = siteHeaders("192.0.2.71")) =>
    demo.enterDemo(
      new H3Event(
        new Request("http://localhost:3000/enter-demo", {
          method: "POST",
          headers,
        }),
      ),
      { ticket },
    );
  await assert.rejects(
    enter(
      started.ticket,
      siteHeaders("192.0.2.71", { origin: "https://elsewhere.example" }),
    ),
    { statusCode: 403 },
  );
  assert.deepEqual(await enter(started.ticket), { person: "maria" });
  await assert.rejects(enter(started.ticket), { statusCode: 410 });
  await assert.rejects(enter("x".repeat(43)), { statusCode: 410 });
  await assert.rejects(enter("not a ticket"), { statusCode: 410 });
  const late = await demo.startDemo(
    { person: "maria" },
    { caller: "http", requestHeaders: siteHeaders("192.0.2.72") },
  );
  await sql.execute(
    "UPDATE eighty_demo_accounts SET ticket_expires_at = now() - interval '1 second' WHERE ticket_hash IS NOT NULL",
  );
  await assert.rejects(enter(late.ticket), { statusCode: 410 });
});

test("No action input can mark or unmark a demo account", async () => {
  for (const extra of [
    { email: "real.member@example.test" },
    { demo: false },
    { userId: real.userId },
    { visitor: "someone" },
  ])
    assert.equal(
      demo.startDemoInput.safeParse({ person: "maria", ...extra }).success,
      false,
    );
  // Every action reachable over HTTP rejects unknown keys such as "demo".
  const names = (await readdir(new URL("../../actions/", import.meta.url)))
    .filter((name) => name.endsWith(".ts") && name !== "run.ts")
    .map((name) => name.slice(0, -3));
  for (const name of names) {
    const action = (await import(`../../actions/${name}.ts`)).default;
    if (!action?.schema || action.http === false) continue;
    if (name === "hello") continue; // Closed by the request filter for everyone.
    const result = action.schema.safeParse({ demo: false, isDemo: false });
    assert.equal(result.success, false, name);
    assert.ok(
      result.error.issues.some(
        (issue) =>
          issue.code === "unrecognized_keys" && issue.keys.includes("demo"),
      ),
      `${name} must reject unknown keys`,
    );
  }
  // The table itself accepts only server-made demo addresses.
  await assert.rejects(
    sql.execute({
      sql: "INSERT INTO eighty_demo_accounts (user_id, email, person, visitor) VALUES (?, ?, 'maria', 'x')",
      args: [real.userId, real.email],
    }),
  );
  // A real member's own record and requests never become demo ones.
  const visitor = await openDemo("maria", "192.0.2.80");
  const lines = await as(visitor, () =>
    evidence.listEvidenceRecords(visitor.context),
  );
  const line = lines.find((row) => row.status === "confirmed");
  await as(visitor, () =>
    evidence.changeEvidenceRecord(
      "edit",
      {
        id: line.id,
        version: line.version,
        fields: { ...line.fields, hours: 1 },
      },
      visitor.context,
    ),
  );
  const [account] = await rows(
    "SELECT email, member_id FROM eighty_demo_accounts WHERE user_id = ?",
    [visitor.userId],
  );
  assert.equal(account.email, visitor.email);
  assert.equal(
    (await as(real, () => demo.demoStatus(real.context))).demo,
    false,
  );
});

test("A demo account cannot reach a real member's record by id, and the reverse", async () => {
  const visitor = await openDemo("maria", "192.0.2.90");
  const sample = await as(visitor, () => demo.addDemoSample(visitor.context));
  const demoLine = (
    await as(visitor, () => evidence.listEvidenceRecords(visitor.context))
  ).find((line) => line.status === "proposed");
  // Demo -> real
  for (const operation of ["confirm", "reject"])
    await assert.rejects(
      as(visitor, () =>
        evidence.changeEvidenceRecord(
          operation,
          { id: realLine.id, version: realLine.version },
          visitor.context,
        ),
      ),
      { statusCode: 404 },
    );
  await assert.rejects(
    as(visitor, () => files.readDocument(realFile.id, visitor.context)),
    { statusCode: 404 },
  );
  await assert.rejects(
    as(visitor, () => files.removeDocument(realFile.id, visitor.context)),
    { statusCode: 404 },
  );
  await assert.rejects(
    as(visitor, () =>
      evidence.createEvidenceDraft(
        { fields: { kind: "work" }, documentId: realFile.id },
        visitor.context,
      ),
    ),
    { statusCode: 404 },
  );
  const seen = await as(visitor, () =>
    evidence.listEvidenceRecords(visitor.context),
  );
  assert.ok(seen.every((line) => line.ownerEmail === visitor.email));
  // Real -> demo
  for (const operation of ["confirm", "reject"])
    await assert.rejects(
      as(real, () =>
        evidence.changeEvidenceRecord(
          operation,
          { id: demoLine.id, version: demoLine.version },
          real.context,
        ),
      ),
      { statusCode: 404 },
    );
  await assert.rejects(
    as(real, () => files.readDocument(sample.id, real.context)),
    { statusCode: 404 },
  );
  const own = await as(real, () => evidence.listEvidenceRecords(real.context));
  assert.deepEqual(
    own.map((line) => line.id),
    [realLine.id],
  );
  // Lists and counts of real members leave demo records out.
  const realRows = await getDb()
    .select({ email: members.ownerEmail })
    .from(members)
    .where(realMembersOnly());
  assert.deepEqual(
    realRows.map((row) => row.email),
    [real.email],
  );
  // A demo account whose server link to its record is broken reaches nothing.
  await sql.execute({
    sql: "UPDATE eighty_demo_accounts SET member_id = NULL WHERE user_id = ?",
    args: [visitor.userId],
  });
  await assert.rejects(
    as(visitor, () => evidence.listEvidenceRecords(visitor.context)),
    { statusCode: 404 },
  );
});

// Each path a demo account must not reach. "member" marks paths a real,
// verified member can reach, so the refusal there is the demo rule itself.
const refused = [
  ["/settings", "GET", "member"],
  ["/settings.data", "GET", "member"],
  ["/settings/account", "GET", "member"],
  ["/navigator", "GET", "member"],
  ["/admin", "GET", "member"],
  ["/admin/members", "GET", "member"],
  ["/proof/packets", "GET", "member"],
  ["/proof/packets/export", "GET", "member"],
  ["/plan", "GET", "member"],
  ["/notice", "GET", "member"],
  ["/_agent-native/actions/prepare_member_account", "POST", "member"],
  ["/_agent-native/actions/finish_member_account", "POST", "member"],
  ["/_agent-native/auth/ba/sign-up/email", "POST", "member"],
  ["/_agent-native/auth/ba/verify-email", "GET", "member"],
  ["/_agent-native/auth/email-link/landing", "GET", "member"],
  ["/_agent-native/auth/ba/sign-in/email", "POST", "member"],
  ["/review", "POST", "member"],
  ["/demo", "POST", "member"],
  ["/_agent-native/auth/ba/change-email", "POST", "closed"],
  ["/_agent-native/auth/ba/change-password", "POST", "closed"],
  ["/_agent-native/auth/ba/update-user", "POST", "closed"],
  ["/_agent-native/auth/ba/delete-user", "POST", "closed"],
  ["/_agent-native/auth/ba/forget-password", "POST", "closed"],
  ["/_agent-native/org/invitations", "POST", "closed"],
  ["/_agent-native/org/members", "GET", "closed"],
  ["/_agent-native/integrations/telegram/webhook", "POST", "closed"],
  ["/_agent-native/integrations/whatsapp/connect", "POST", "closed"],
  ["/_agent-native/email/send", "POST", "closed"],
  ["/_agent-native/agent-chat", "POST", "closed"],
  ["/_agent-native/actions/hello", "GET", "closed"],
  ["/_agent-native/actions/navigate", "POST", "closed"],
  ["/_agent-native/actions/provider-api-request", "POST", "closed"],
  ["/_agent-native/db/query", "POST", "closed"],
  ["/_agent-native/resources", "GET", "closed"],
  ["/database", "GET", "closed"],
  ["/extensions", "GET", "closed"],
  ["/observability", "GET", "closed"],
  ["/team", "GET", "closed"],
  ["/agent", "GET", "closed"],
  ["/chat", "GET", "closed"],
  ["/share/export", "GET", "closed"],
];
let refusedVisitor;
const request = (path, method, cookie) =>
  middleware(
    new H3Event(
      new Request(`http://localhost:3000${path}`, {
        method,
        headers: { cookie },
      }),
    ),
  );

for (const [path, method, kind] of refused)
  test(`A demo account is refused ${method} ${path}`, async () => {
    const visitor =
      refusedVisitor ??
      (refusedVisitor = await openDemo("maria", "192.0.2.200"));
    assert.equal(isDemoAllowedRequest(path, method), false);
    await assert.rejects(request(path, method, visitor.cookie), {
      status: kind === "member" ? 403 : 404,
    });
    if (kind === "member") {
      // The same request from a real member is not stopped by the demo rule.
      try {
        await request(path, method, real.cookie);
      } catch (error) {
        assert.notEqual(error.message, "This is not part of the demo.");
      }
    }
  });

test("A demo account reaches its own pages and actions", async () => {
  const visitor =
    refusedVisitor ?? (refusedVisitor = await openDemo("maria", "192.0.2.200"));
  for (const [path, method] of [
    ["/demo", "GET"],
    ["/review", "GET"],
    ["/add.data", "GET"],
    ["/months", "GET"],
    ["/", "GET"],
    ["/help", "GET"],
    ["/demo/maria-earnings-sample.pdf", "GET"],
    ["/_agent-native/actions/list_evidence", "GET"],
    ["/_agent-native/actions/confirm_evidence", "POST"],
    ["/_agent-native/actions/upload_document", "POST"],
    ["/_agent-native/actions/remove_document", "POST"],
    ["/_agent-native/actions/demo_month", "GET"],
    ["/_agent-native/actions/add_demo_sample", "POST"],
    ["/_agent-native/auth/ba/sign-out", "POST"],
  ]) {
    assert.equal(isDemoAllowedRequest(path, method), true, path);
    await request(path, method, visitor.cookie);
  }
});

test("Account actions refuse a demo account inside the action too", async () => {
  const visitor = await openDemo("rosa", "192.0.2.210");
  const prepare = (await import("../../actions/prepare_member_account.ts"))
    .default;
  const finish = (await import("../../actions/finish_member_account.ts"))
    .default;
  const prepareInput = {
    email: "new.person@example.test",
    consent: true,
    profile: { language: "en-US", screener: {} },
  };
  for (const [action, input] of [
    [prepare, prepareInput],
    [finish, { draft: "anything" }],
  ])
    await assert.rejects(
      as(visitor, () => action.run(input, visitor.context)),
      { statusCode: 403 },
    );
  // Without the signed-in identity, the cookie alone is enough to refuse.
  await assert.rejects(
    prepare.run(prepareInput, {
      caller: "http",
      requestHeaders: visitor.context.requestHeaders,
    }),
    { statusCode: 403 },
  );
  // Demo addresses cannot be used to make a real account either.
  const { refuseDemoEmail } = await import("../../server/lib/demo-identity.ts");
  assert.throws(() => refuseDemoEmail(visitor.email), { statusCode: 403 });
  assert.doesNotThrow(() => refuseDemoEmail(real.email));
  // Demo-only screens refuse real members.
  await assert.rejects(
    as(real, () => demo.demoMonth(real.context)),
    {
      statusCode: 403,
    },
  );
  await assert.rejects(
    as(real, () => demo.addDemoSample(real.context)),
    {
      statusCode: 403,
    },
  );
});

test("The demo actions are hidden from the agent and MCP", async () => {
  for (const name of [
    "start_demo",
    "demo_status",
    "demo_month",
    "add_demo_sample",
  ]) {
    const action = (await import(`../../actions/${name}.ts`)).default;
    assert.equal(action.agentTool, false, name);
    assert.equal(action.mcpTool, false, name);
    assert.equal(action.audit?.recordInputs, false, name);
  }
  assert.equal(
    (await import("../../actions/add_demo_sample.ts")).default.uiOnly,
    true,
  );
});
