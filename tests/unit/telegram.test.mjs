// Telegram: what a message carries, who it may act for, and what each kind of
// message gets back. The database, identity checks and month code are real.
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
const telegram = await import("../../server/lib/telegram.ts");
const words = await import("../../shared/telegram-words.ts");
const links = await import("../../server/lib/telegram-links.ts");
const { telegramLink } = await import(
  "../../server/lib/telegram-link-action.ts"
);
const { ownMemberActor } = await import("../../server/lib/member-identity.ts");
const { runWithRequestContext } = await import("@agent-native/core/server");
const access = await import("../../shared/access.ts");
const action = (await import("../../actions/telegram_link.ts")).default;

const rows = async (query, args = []) =>
  (await sql.execute({ sql: query, args })).rows;

const update = (message) => ({
  update_id: 1,
  message: {
    message_id: 7,
    date: 1793628000,
    chat: { id: 4242, type: "private" },
    from: { id: 99, first_name: "Maria", language_code: "es" },
    ...message,
  },
});
const incoming = (chatId, rawText, extra = {}) => ({
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
    ...extra,
  },
  timestamp: Date.now(),
});

test("Telegram settings come from the deployment, never from a member's secrets", async () => {
  // In production the framework will not let a signed-in member's request fall
  // back to deployment values, so reading these through resolveSecret showed
  // members "Telegram linking is switched off".
  const { readFileSync } = await import("node:fs");
  const config = await import("../../server/lib/telegram-config.ts");
  for (const file of [
    "server/lib/telegram.ts",
    "server/lib/telegram-link-action.ts",
    "server/plugins/integrations.ts",
  ]) {
    const text = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(text, /resolveSecret\(\s*["'](TELEGRAM_BOT_TOKEN|EIGHTY_TELEGRAM_BOT)/, file);
  }
  assert.equal(config.configuredBotName(), "TryEightybot");
  const before = process.env.EIGHTY_TELEGRAM_BOT;
  process.env.EIGHTY_TELEGRAM_BOT = " @TryEightybot "; // guard:allow-env-credential — test process only: a public bot name
  assert.equal(config.configuredBotName(), "TryEightybot");
  process.env.EIGHTY_TELEGRAM_BOT = before; // guard:allow-env-credential — test process only: restore
});

test("photos, PDFs and voice notes reach the app with their file", () => {
  const photo = telegram.parseTelegramUpdate(
    update({
      caption: "pay stub",
      photo: [
        { file_id: "small", file_size: 100 },
        { file_id: "large", file_size: 9000 },
      ],
    }),
  );
  assert.equal(photo.platformContext.fileKind, "photo");
  assert.deepEqual(photo.files, [
    { id: "large", mimetype: "image/jpeg", size: 9000 },
  ]);
  assert.equal(photo.text, "pay stub");

  const pdf = telegram.parseTelegramUpdate(
    update({
      document: {
        file_id: "doc",
        file_name: "stub.pdf",
        mime_type: "application/pdf",
        file_size: 2000,
      },
    }),
  );
  assert.equal(pdf.platformContext.fileKind, "document");
  assert.equal(pdf.files[0].mimetype, "application/pdf");
  assert.equal(pdf.text, "");

  const voice = telegram.parseTelegramUpdate(
    update({
      voice: { file_id: "v", mime_type: "audio/ogg", file_size: 300 },
    }),
  );
  assert.equal(voice.platformContext.fileKind, "voice");
  assert.equal(voice.files[0].id, "v");

  const text = telegram.parseTelegramUpdate(update({ text: "/status" }));
  assert.equal(text.platformContext.rawText, "/status");
  assert.equal(text.platformContext.fileKind, null);
  assert.equal(text.conversationType, "dm");
});

test("unsupported media is kept as a refusal, edits and empty updates are ignored", () => {
  const video = telegram.parseTelegramUpdate(
    update({ video: { file_id: "x" } }),
  );
  assert.equal(video.platformContext.fileKind, "unsupported");
  assert.deepEqual(video.files, []);
  assert.equal(
    telegram.parseTelegramUpdate({
      edited_message: update({ text: "changed" }).message,
    }),
    null,
  );
  assert.equal(telegram.parseTelegramUpdate(update({})), null);
  assert.equal(telegram.parseTelegramUpdate(null), null);
  const group = telegram.parseTelegramUpdate(
    update({ text: "hi", chat: { id: -5, type: "group" } }),
  );
  assert.equal(group.conversationType, "group_dm");
});

test("link codes are typed loosely but read exactly", () => {
  assert.equal(links.normalizeLinkCode("abcd-efgh"), "ABCDEFGH");
  assert.equal(links.normalizeLinkCode(" abcd efgh "), "ABCDEFGH");
  assert.equal(links.normalizeLinkCode("ABCDEFG"), null);
  assert.equal(links.normalizeLinkCode("ABCDEFG0"), null, "no zero");
  assert.equal(links.normalizeLinkCode("ABCDEFGI"), null, "no I");
  assert.equal(links.normalizeLinkCode("hello there"), null);
});

test("the link action is the member's own, in their browser only", () => {
  assert.equal(action.uiOnly, true);
  assert.equal(action.agentTool, false);
  assert.equal(action.mcpTool, false);
});

test("a code links one private chat to the member who made it, once", async () => {
  const maria = await openExample("maria", "203.0.113.41");
  const made = await as(maria, () => telegramLink("code", maria.context));
  assert.equal(made.available, true);
  assert.equal(made.linked, false);
  assert.match(made.code, /^[A-HJ-NP-Z2-9]{8}$/);
  assert.equal(made.url, `https://t.me/TryEightybot?start=${made.code}`);
  const stored = await rows("SELECT code_hash FROM eighty_telegram_codes");
  assert.equal(stored.length, 1);
  assert.notEqual(stored[0].code_hash, made.code, "only the hash is kept");

  const group = await telegram.beforeTelegramMessage({
    ...incoming(-1, `/start ${made.code}`),
    platformContext: {
      chatId: -1,
      chatType: "group",
      rawText: `/start ${made.code}`,
    },
  });
  assert.equal(group.handled, true);
  assert.match(group.responseText, /private chat/);

  const linked = await telegram.beforeTelegramMessage(
    incoming(4242, `/start ${made.code}`),
  );
  assert.equal(linked.handled, true);
  assert.match(linked.responseText, /^Linked\./);
  assert.match(linked.responseText, /Maria \(example\)/);

  const again = await telegram.beforeTelegramMessage(
    incoming(5151, made.code),
  );
  assert.match(again.responseText, /didn't work/, "a code works once");

  const status = await as(maria, () => telegramLink("status", maria.context));
  assert.equal(status.linked, true);
  assert.equal(status.code, null);
});

test("a linked chat acts only for its own member", async () => {
  const maria = await openExample("maria", "203.0.113.42");
  const real = await realMember("telegram.real@example.test");
  const mariaCode = (await as(maria, () => telegramLink("code", maria.context)))
    .code;
  const realCode = (await as(real, () => telegramLink("code", real.context)))
    .code;
  await telegram.beforeTelegramMessage(incoming(1001, mariaCode));
  await telegram.beforeTelegramMessage(incoming(1002, `/start ${realCode}`));

  const context = await telegram.telegramExecutionContext(incoming(1001, "hi"));
  assert.equal(context.ownerEmail, maria.email);
  assert.equal(context.principalType, "user");
  // An unlinked chat gets no member: the framework asks before the code is read.
  assert.deepEqual(await telegram.telegramExecutionContext(incoming(1003, "hi")), {
    ownerEmail: "integration@telegram",
    orgId: null,
    principalType: "service",
  });
  await assert.rejects(
    runWithRequestContext({ userEmail: "integration@telegram" }, () =>
      ownMemberActor({ caller: "tool", userEmail: "integration@telegram" }),
    ),
  );

  // The helper's run from chat 1001 resolves to Maria's account and nobody else's.
  const run = (email, chatId) =>
    runWithRequestContext(
      {
        userEmail: email,
        isIntegrationCaller: true,
        integration: {
          incoming: { platform: "telegram", platformContext: { chatId } },
        },
      },
      () => ownMemberActor({ caller: "tool", userEmail: email }),
    );
  assert.deepEqual(await run(maria.email, 1001), {
    email: maria.email,
    userId: maria.userId,
  });
  await assert.rejects(run(maria.email, 1002), (error) => {
    assert.ok([401, 403].includes(error.statusCode));
    return true;
  });
  await assert.rejects(run(real.email, 1001), (error) => {
    assert.ok([401, 403].includes(error.statusCode));
    return true;
  });
  // Without the integration marks, a bare email in context is not enough.
  await assert.rejects(
    runWithRequestContext({ userEmail: maria.email }, () =>
      ownMemberActor({ caller: "tool", userEmail: maria.email }),
    ),
  );
});

test("each kind of message gets the right answer", async () => {
  const maria = await openExample("maria", "203.0.113.43");
  const code = (await as(maria, () => telegramLink("code", maria.context)))
    .code;
  await telegram.beforeTelegramMessage(incoming(2001, code));

  const unlinked = await telegram.beforeTelegramMessage(incoming(2999, "hola"));
  assert.equal(unlinked.handled, true);
  assert.match(unlinked.responseText, /isn't linked/);
  const welcome = await telegram.beforeTelegramMessage(
    incoming(2999, "/start"),
  );
  assert.match(welcome.responseText, /I'm Eighty/);

  const status = await telegram.beforeTelegramMessage(
    incoming(2001, "/status"),
  );
  assert.equal(status.handled, true);
  assert.match(status.responseText, /This month: Below the line\./);
  assert.match(status.responseText, /of 80 hours confirmed/);
  assert.match(status.responseText, /hours still needed/);
  assert.match(
    status.responseText,
    /https:\/\/www\.ecfr\.gov\/current\/title-42\/section-435\.\d{3}/,
  );

  const unsupported = await telegram.beforeTelegramMessage(
    incoming(2001, "", { fileKind: "unsupported" }),
  );
  assert.match(unsupported.responseText, /photos, PDFs and voice notes/);

  const help = await telegram.beforeTelegramMessage(incoming(2001, "/help"));
  assert.match(help.responseText, /\/status/);

  // A typed message goes on to the member's helper.
  const typed = await telegram.beforeTelegramMessage(
    incoming(2001, "I volunteered 4 hours at the pantry on Saturday"),
  );
  assert.deepEqual(typed, { handled: false });

  const stopped = await telegram.beforeTelegramMessage(
    incoming(2001, "/stop"),
  );
  assert.match(stopped.responseText, /^Unlinked\./);
  const after = await telegram.beforeTelegramMessage(incoming(2001, "hi"));
  assert.match(after.responseText, /isn't linked/);
});

test("a file Telegram can't hand over gets a plain answer", async () => {
  const maria = await openExample("maria", "203.0.113.44");
  const code = (await as(maria, () => telegramLink("code", maria.context)))
    .code;
  await telegram.beforeTelegramMessage(incoming(3001, code));
  const realFetch = globalThis.fetch;
  // guard:allow-env-mutation — test process only: a token so the file request is made
  process.env.TELEGRAM_BOT_TOKEN = "1:test"; // guard:allow-env-credential — test process only: a fake token; Telegram is replaced by a stub fetch
  try {
    globalThis.fetch = async (url) =>
      String(url).includes("/getFile")
        ? Response.json({
            ok: true,
            result: { file_path: "big.pdf", file_size: 40 * 1024 * 1024 },
          })
        : new Response("nope", { status: 500 });
    const big = await telegram.beforeTelegramMessage({
      ...incoming(3001, "", { fileKind: "document" }),
      files: [{ id: "big", mimetype: "application/pdf" }],
    });
    assert.match(big.responseText, /too big/);

    globalThis.fetch = async () => Response.json({ ok: false });
    const lost = await telegram.beforeTelegramMessage({
      ...incoming(3001, "", { fileKind: "photo" }),
      files: [{ id: "gone", mimetype: "image/jpeg" }],
    });
    assert.match(lost.responseText, /couldn't get that file/);
  } finally {
    globalThis.fetch = realFetch;
    // guard:allow-env-mutation — test process only
    delete process.env.TELEGRAM_BOT_TOKEN; // guard:allow-env-credential — test process only: removes the fake token
  }
});

test("a new code replaces the old one, and unlinking clears both", async () => {
  const daniel = await openExample("daniel", "203.0.113.45");
  const first = (await as(daniel, () => telegramLink("code", daniel.context)))
    .code;
  const second = (await as(daniel, () => telegramLink("code", daniel.context)))
    .code;
  const old = await telegram.beforeTelegramMessage(incoming(4001, first));
  assert.match(old.responseText, /didn't work/);
  const ok = await telegram.beforeTelegramMessage(incoming(4001, second));
  assert.match(ok.responseText, /Daniel \(example\)/);
  const cleared = await as(daniel, () => telegramLink("unlink", daniel.context));
  assert.equal(cleared.linked, false);
  const gone = await telegram.beforeTelegramMessage(incoming(4001, "hi"));
  assert.match(gone.responseText, /isn't linked/);
});

test("Telegram's two paths are open, by POST only, and nothing else is", () => {
  for (const path of access.TELEGRAM_PATHS) {
    assert.equal(access.isAllowedRequest(path, "POST"), true);
    assert.equal(access.isTelegramPath(path), true);
  }
  assert.equal(
    access.isTelegramPath("/_agent-native/integrations/telegram/setup"),
    false,
  );
  assert.equal(
    access.isAllowedRequest("/_agent-native/integrations/telegram/setup", "POST"),
    false,
  );
  assert.equal(
    access.isExampleAllowedRequest("/_agent-native/actions/telegram_link", "POST"),
    true,
  );
});

test("the bot's words: plain first, the rule underneath", () => {
  const text = words.monthText(
    {
      status: "Short",
      citation: "42 CFR 435.554(a)",
      hours: 61,
      targetHours: 80,
    },
    "es",
  );
  assert.equal(
    text,
    [
      "Este mes: Falta para llegar a la meta. 61 de 80 horas confirmadas.",
      "Faltan 19 horas.",
      "Regla: 42 CFR 435.554(a) — https://www.ecfr.gov/current/title-42/section-435.554",
      "Tu estado decide.",
    ].join("\n"),
  );
  assert.equal(
    words.lineText(
      {
        kind: "service",
        organization: "Food pantry",
        hours: 4,
        start: "2026-11-07",
        end: "2026-11-07",
      },
      "en",
    ),
    "Volunteer service · Food pantry · 4 h · 2026-11-07",
  );
  assert.equal(
    words.lineText(
      { kind: "income", income: { receivedOn: "2026-11-01", grossPayCents: 61250 } },
      "en",
    ),
    "Pay · $612.50 · 2026-11-01",
  );
});
