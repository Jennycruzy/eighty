// "Do my month": the agent reads, lists, asks and plans; only the member confirms.
import assert from "node:assert/strict";
import test from "node:test";

import {
  as,
  openExample,
  prepareDatabase,
  realMember,
} from "../helpers/example-database.mjs";

// guard:allow-env-mutation — test process only: the bot name shown with a code
process.env.EIGHTY_TELEGRAM_BOT = "TryEightybot"; // guard:allow-env-credential — test process only: a public bot name, not a secret

const sql = await prepareDatabase();
const { doMonth, planSteps } = await import("../../server/lib/month-work.ts");
const { monthWorkText } = await import("../../server/lib/month-work-text.ts");
const evidence = await import("../../server/lib/evidence-records.ts");
const { today } = await import("../../server/lib/example-accounts.ts");
const { MARIA, EXAMPLE_PROFILES } = await import(
  "../../server/lib/example-people.ts"
);
const { telegramLink } = await import(
  "../../server/lib/telegram-link-action.ts"
);
const telegram = await import("../../server/lib/telegram.ts");
const action = (await import("../../actions/do_my_month.ts")).default;
const confirmAction = (await import("../../actions/confirm_evidence.ts"))
  .default;
const { MONTH_AGENT_TOOLS, TELEGRAM_AGENT_TOOLS } = await import(
  "../../server/lib/month-agent.ts"
);

const look = (account) =>
  as(account, () => doMonth({ read: false }, account.context));
const statuses = async (account) =>
  (await as(account, () => evidence.listEvidenceRecords(account.context))).map(
    (row) => [row.id, row.status, row.version],
  );

test("the action is the member's own agent tool and the month card renderer", () => {
  assert.equal(action.agentTool, true);
  assert.equal(action.mcpTool, true, "a connected assistant may do the month; it never reads files or confirms");
  assert.equal(action.chatUI.renderer, "eighty.month-work");
  assert.equal(confirmAction.agentTool, false);
  assert.equal(confirmAction.uiOnly, true);
  assert.ok(MONTH_AGENT_TOOLS.includes("do_my_month"));
  assert.ok(TELEGRAM_AGENT_TOOLS.includes("do_my_month"));
  assert.ok(!MONTH_AGENT_TOOLS.includes("confirm_evidence"));
  assert.ok(!TELEGRAM_AGENT_TOOLS.includes("confirm_evidence"));
});

test("members and example visitors can reach the action through the site and its proxy", async () => {
  const access = await import("../../shared/access.ts");
  const { readFileSync } = await import("node:fs");
  const path = "/_agent-native/actions/do_my_month";
  assert.equal(access.isAllowedRequest(path, "POST"), true);
  assert.equal(access.isExampleAllowedRequest(path, "POST"), true);
  const caddy = readFileSync(new URL("../../deploy/Caddyfile", import.meta.url), "utf8");
  assert.ok(caddy.split(/\s+/).includes(path));
});

test("Maria's month: the lines waiting, and a plan the rules accept", async () => {
  const maria = await openExample("maria", "198.51.100.81");
  const work = await look(maria);
  assert.equal(work.widget, "eighty.month-work");
  assert.equal(work.example, true);
  assert.equal(work.now.status, "Short");
  assert.equal(work.now.hours, MARIA.deliveryHours + MARIA.pantryHours);
  assert.equal(work.done, false);
  assert.equal(work.waiting.length, 1, "the corner market line from last month");
  assert.equal(work.waiting[0].fields.organization, MARIA.corner);
  assert.equal(work.plan.hoursNeeded, 80 - 61);
  const places = work.plan.steps.map((step) => step.organization).sort();
  assert.deepEqual(places, [MARIA.delivery, MARIA.pantry].sort());
  for (const step of work.plan.steps) assert.equal(step.hours, 19);
});

test("doing the month never confirms, edits or rejects a line", async () => {
  const maria = await openExample("maria", "198.51.100.82");
  const before = await statuses(maria);
  await as(maria, () =>
    action.run({ read: true }, { ...maria.context, caller: "tool" }),
  );
  assert.deepEqual(await statuses(maria), before);
});

test("Maria goes from Below the line to Meets through the cards alone", async () => {
  const maria = await openExample("maria", "198.51.100.83");
  // What the reader proposes from her sample earnings summary: pay before costs,
  // and the question only she can answer.
  const d = today();
  const proposed = await as(maria, () =>
    evidence.createEvidenceDraft(
      {
        fields: {
          kind: "income",
          organization: MARIA.delivery,
          start: `${d.slice(0, 7)}-01`,
          end: d,
          income: {
            kind: "self-employment",
            receivedOn: d,
            grossPayCents: MARIA.sample.totalCents,
          },
        },
      },
      maria.context,
      "agent",
    ),
  );
  const asked = await look(maria);
  assert.equal(asked.question.key, "business-costs");
  assert.equal(asked.question.lineId, proposed.id);
  assert.equal(asked.question.grossPayCents, MARIA.sample.totalCents);
  assert.equal(asked.question.organization, MARIA.delivery);
  assert.equal(asked.now.status, "Not sure yet", "a waiting pay line holds the month, as on the page");

  // The question card: she types her costs, the card saves the line.
  const line = asked.waiting.find((item) => item.id === proposed.id);
  const edited = await as(maria, () =>
    evidence.changeEvidenceRecord(
      "edit",
      {
        id: line.id,
        version: line.version,
        fields: {
          ...line.fields,
          income: {
            ...line.fields.income,
            netEarningsCents: MARIA.sample.totalCents - MARIA.sample.costsCents,
            costsConfirmed: true,
          },
        },
      },
      maria.context,
    ),
  );
  const answered = await look(maria);
  assert.equal(answered.question, null);
  assert.equal(answered.ifConfirmed.amountCents, MARIA.sample.netCents);

  // The confirm button on the card.
  await as(maria, () =>
    evidence.changeEvidenceRecord(
      "confirm",
      { id: edited.id, version: edited.version },
      maria.context,
    ),
  );
  const finished = await look(maria);
  assert.equal(finished.now.status, "Meets");
  assert.equal(finished.now.amountCents, MARIA.sample.netCents);
  assert.equal(finished.done, true);
  assert.equal(finished.plan, null);
});

test("a plan step must pass the rules: a service place without its facts is left out", () => {
  const month = today().slice(0, 7);
  const facts = EXAMPLE_PROFILES.maria.facts;
  const line = (id, fields) => ({
    id,
    version: 1,
    status: "confirmed",
    documentId: null,
    fields,
  });
  const bare = [
    line("a", {
      kind: "service",
      organization: "Library (made up)",
      start: `${month}-02`,
      end: `${month}-02`,
      hours: 3,
    }),
  ];
  assert.deepEqual(planSteps(facts, bare, month, 77), []);
  const work = [
    line("b", {
      kind: "work",
      organization: "Shop (made up)",
      start: `${month}-02`,
      end: `${month}-02`,
      hours: 5,
    }),
    line("c", {
      kind: "work",
      organization: "Shop (made up)",
      start: `${month}-03`,
      end: `${month}-03`,
      hours: 6,
    }),
  ];
  const [step] = planSteps(facts, work, month, 69);
  assert.equal(step.organization, "Shop (made up)");
  assert.equal(step.shiftHours, 6);
  assert.equal(step.shifts, 12);
  assert.deepEqual(planSteps(facts, work, month, 0), []);
});

test("a member's own month, with nothing saved yet", async () => {
  const member = await realMember("month-work@example.test");
  const work = await look(member);
  assert.equal(work.example, false);
  assert.equal(work.waiting.length, 0);
  assert.equal(work.read.length, 0);
  assert.equal(work.unread, 0);
});

test("the Telegram message says the same, in English and Spanish", async () => {
  const maria = await openExample("maria", "198.51.100.84");
  const work = await look(maria);
  const en = monthWorkText(work, "en");
  assert.match(en, /^I did your month's paperwork:/);
  assert.match(en, /Lines waiting for you:/);
  assert.match(en, /Plan: 19 hours still needed by/);
  assert.match(en, new RegExp(MARIA.pantry.replace(/[()]/g, "\\$&")));
  assert.match(en, /This month: Below the line\. 61 of 80 hours confirmed\./);
  assert.match(en, /Only you confirm each line: https:\/\/tryeighty\.space\/review/);
  const es = monthWorkText(work, "es");
  assert.match(es, /^Hice el papeleo de tu mes:/);
  assert.match(es, /Plan: faltan 19 horas antes del/);
  assert.match(es, /Tu estado decide\./);
});

const incoming = (chatId, rawText) => ({
  platform: "telegram",
  externalThreadId: `chat:${chatId}`,
  text: rawText,
  files: [],
  senderId: "99",
  platformContext: {
    chatId,
    chatType: "private",
    rawText,
    fileKind: null,
    languageCode: "en",
  },
  timestamp: Date.now(),
});

test("/month in Telegram does the month, and /espanol and /english switch the language", async () => {
  const maria = await openExample("maria", "198.51.100.85");
  const code = (await as(maria, () => telegramLink("code", maria.context)))
    .code;
  await telegram.beforeTelegramMessage(incoming(3101, code));
  const month = await telegram.beforeTelegramMessage(incoming(3101, "/month"));
  assert.equal(month.handled, true);
  assert.match(month.responseText, /^I did your month's paperwork:/);

  const es = await telegram.beforeTelegramMessage(incoming(3101, "/espanol"));
  assert.match(es.responseText, /ahora te respondo en español/);
  const linked = await as(maria, () => telegramLink("status", maria.context));
  assert.equal(linked.language, "es-US");
  const status = await telegram.beforeTelegramMessage(incoming(3101, "/status"));
  assert.match(status.responseText, /^Este mes:/);

  const en = await telegram.beforeTelegramMessage(incoming(3101, "/english"));
  assert.match(en.responseText, /answer in English now/);
  const back = await telegram.beforeTelegramMessage(incoming(3101, "/status"));
  assert.match(back.responseText, /^This month:/);

  // The switch on the web card does the same.
  const web = await as(maria, () =>
    telegramLink("language", maria.context, "es-US"),
  );
  assert.equal(web.language, "es-US");
  const rows = await sql.execute({
    sql: "SELECT language FROM eighty_members WHERE owner_email = ?",
    args: [maria.email],
  });
  assert.equal(rows.rows[0].language, "es-US");
});
