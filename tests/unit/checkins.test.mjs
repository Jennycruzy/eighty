// The agent works ahead: a weekly plan when a month falls short, reminders
// before a state letter's reply date, and an off switch the member controls.
import assert from "node:assert/strict";
import test from "node:test";

import { as, openExample, prepareDatabase } from "../helpers/example-database.mjs";

// guard:allow-env-mutation — test process only: the bot name shown with a code
process.env.EIGHTY_TELEGRAM_BOT = "TryEightybot"; // guard:allow-env-credential — test process only: a public bot name, not a secret

const sql = await prepareDatabase();
const reminders = await import("../../server/lib/member-reminders.ts");
const checkins = await import("../../server/lib/checkins.ts");
const { today } = await import("../../server/lib/example-accounts.ts");
const { telegramLink } = await import("../../server/lib/telegram-link-action.ts");
const telegram = await import("../../server/lib/telegram.ts");
const { hasJobRunner } = await import("@agent-native/core/server");
const { parseJobFrontmatter } = await import("@agent-native/core/jobs");
const { resourceGetByPath, SHARED_OWNER } = await import("@agent-native/core/resources");
const access = await import("../../shared/access.ts");
const noticeAction = (await import("../../actions/notice_date.ts")).default;

const incoming = (chatId, rawText) => ({
  platform: "telegram",
  externalThreadId: `chat:${chatId}`,
  text: rawText,
  files: [],
  senderId: "99",
  platformContext: { chatId, chatType: "private", rawText, fileKind: null },
  timestamp: Date.now(),
});
async function linkedMaria(ip, chatId) {
  const maria = await openExample("maria", ip);
  const code = (await as(maria, () => telegramLink("code", maria.context))).code;
  await telegram.beforeTelegramMessage(incoming(chatId, code));
  return maria;
}
const linkRow = async (chatId) =>
  (await sql.execute({ sql: "SELECT * FROM eighty_telegram_links WHERE chat_id = ?", args: [String(chatId)] })).rows[0];

test("dates as people type them", () => {
  const t = "2026-11-09";
  assert.equal(reminders.parseTypedDate("2026-11-03", t), "2026-11-03");
  assert.equal(reminders.parseTypedDate("11/3", t), "2026-11-03");
  assert.equal(reminders.parseTypedDate("12/20", t), "2025-12-20", "no year: the most recent one");
  assert.equal(reminders.parseTypedDate("11/3/26", t), "2026-11-03");
  assert.equal(reminders.parseTypedDate("2/30", t), null);
  assert.equal(reminders.parseTypedDate("soon", t), null);
});

test("the notice rule: 5 days to arrive, 30 to reply, reminders 7 days and 1 day before", () => {
  const dates = reminders.noticeDates("2026-11-03", null);
  assert.equal(dates.countedAsReceived, "2026-11-08");
  assert.equal(dates.reminderDeadline, "2026-12-08");
  assert.match(reminders.noticeText(dates, "2026-11-03", "en", "2026-11-09"), /Reply by Tuesday, December 8 \(29 days from today\)/);
  assert.match(reminders.noticeText(dates, "2026-11-03", "es", "2026-11-09"), /Responde a más tardar el martes, 8 de diciembre/);
  assert.match(reminders.noticeReminder("2026-11-03", null, "2026-12-01", "en"), /due Tuesday, December 8, in 7 days/);
  assert.match(reminders.noticeReminder("2026-11-03", null, "2026-12-07", "en"), /tomorrow/);
  assert.equal(reminders.noticeReminder("2026-11-03", null, "2026-12-02", "en"), null);
  const late = reminders.noticeDates("2026-11-03", "2026-11-20");
  assert.equal(late.laterArrivalNeedsProof, true);
  assert.match(reminders.noticeText(late, "2026-11-03", "en", "2026-11-21"), /It came late: keep proof/);
});

test("/notice and /checkins in Telegram, and the same on the web", async () => {
  const maria = await linkedMaria("198.51.100.101", 4101);
  const how = await telegram.beforeTelegramMessage(incoming(4101, "/notice"));
  assert.match(how.responseText, /date printed on the letter/);
  const saved = await telegram.beforeTelegramMessage(incoming(4101, "/notice 11/3"));
  assert.match(saved.responseText, /Reply by/);
  assert.match(saved.responseText, /435\.558/);
  const web = await as(maria, () => reminders.noticeDateAction({ op: "status" }, maria.context));
  assert.equal(web.dates.reminderDeadline, reminders.noticeDates(web.printed, null).reminderDeadline);

  const off = await telegram.beforeTelegramMessage(incoming(4101, "/checkins off"));
  assert.match(off.responseText, /Check-ins are off/);
  assert.equal((await linkRow(4101)).checkins, false);
  const card = await as(maria, () => telegramLink("checkins", maria.context, undefined, true));
  assert.equal(card.checkins, true);
  assert.equal((await linkRow(4101)).checkins, true);

  assert.equal(noticeAction.agentTool, false);
  assert.equal(access.isExampleAllowedRequest("/_agent-native/actions/notice_date", "POST"), true);
  assert.equal(access.isAllowedRequest("/_agent-native/actions/notice_date", "POST"), true);
});

test("the check-in: Maria's short month gets her plan once a week, at most one message a day, never when off", async () => {
  await linkedMaria("198.51.100.102", 4102);
  const month = today().slice(0, 7);
  const sent = [];
  const send = async (chatId, text) => sent.push({ chatId, text });
  const day = (n) => `${month}-${String(n).padStart(2, "0")}`;

  await checkins.runCheckins({ today: day(5), send });
  assert.equal(sent.filter((m) => m.chatId === "4102").length, 0, "too early in the month");

  await checkins.runCheckins({ today: day(12), send });
  const first = sent.filter((m) => m.chatId === "4102");
  assert.equal(first.length, 1);
  assert.match(first[0].text, /Checking in on your month/);
  assert.match(first[0].text, /hours still needed/);
  assert.match(first[0].text, /\/checkins off/);

  await checkins.runCheckins({ today: day(12), send });
  await checkins.runCheckins({ today: day(15), send });
  assert.equal(sent.filter((m) => m.chatId === "4102").length, 1, "once a day, once a week");
  await checkins.runCheckins({ today: day(19), send });
  assert.equal(sent.filter((m) => m.chatId === "4102").length, 2, "a week later, again");

  await telegram.beforeTelegramMessage(incoming(4102, "/checkins off"));
  await checkins.runCheckins({ today: day(27), send });
  assert.equal(sent.filter((m) => m.chatId === "4102").length, 2, "off means off");
});

test("a letter's reminder goes out 7 days before its reply date", async () => {
  await linkedMaria("198.51.100.103", 4103);
  const printed = "2026-11-03";
  await telegram.beforeTelegramMessage(incoming(4103, `/notice ${printed}`));
  const sent = [];
  await checkins.runCheckins({ today: "2026-12-01", send: async (chatId, text) => sent.push({ chatId, text }) });
  const mine = sent.filter((m) => m.chatId === "4103");
  assert.equal(mine.length, 1);
  assert.match(mine[0].text, /Reminder: your reply to the state's letter is due Tuesday, December 8, in 7 days/);
});

test("the framework runs it: a job file with Eighty's runner, no model", async () => {
  await checkins.setUpCheckins();
  assert.equal(hasJobRunner(checkins.CHECKIN_RUNNER), true);
  const job = await resourceGetByPath(SHARED_OWNER, checkins.CHECKIN_JOB_PATH);
  const { meta, body } = parseJobFrontmatter(job.content);
  assert.equal(meta.runner, checkins.CHECKIN_RUNNER);
  assert.equal(meta.schedule, checkins.CHECKIN_SCHEDULE);
  assert.equal(meta.enabled, true);
  assert.equal(meta.mode, "deterministic");
  assert.match(body, /no model is used/);
  // Starting again keeps the same file and its run history.
  await checkins.setUpCheckins();
  const again = await resourceGetByPath(SHARED_OWNER, checkins.CHECKIN_JOB_PATH);
  assert.equal(again.updatedAt, job.updatedAt);
});
