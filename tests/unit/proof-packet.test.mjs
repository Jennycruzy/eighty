// The proof packet: made from the member's own confirmed lines, for a month
// that meets the rule, with the documents behind it, in English and Spanish.
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

await prepareDatabase();
const { PDFDocument } = await import("pdf-lib");
const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
const packets = await import("../../server/lib/proof-packet.ts");
const evidence = await import("../../server/lib/evidence-records.ts");
const { today, addExampleSample, exampleMonth } = await import(
  "../../server/lib/example-accounts.ts"
);
const { MARIA } = await import("../../server/lib/example-people.ts");
const { shiftMonth } = await import("../../server/rules/dates.ts");
const { doMonth } = await import("../../server/lib/month-work.ts");
const { monthWorkText } = await import("../../server/lib/month-work-text.ts");
const { telegramLink } = await import(
  "../../server/lib/telegram-link-action.ts"
);
const telegram = await import("../../server/lib/telegram.ts");
const access = await import("../../shared/access.ts");
const action = (await import("../../actions/proof_packet.ts")).default;

const current = today().slice(0, 7);
const previous = shiftMonth(current, -1);

async function textOf(bytes, page = 1) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  const doc = await task.promise;
  const content = await (await doc.getPage(page)).getTextContent();
  const text = content.items.map((item) => item.str).join(" ");
  await task.destroy();
  return text.replace(/\s+/g, " ");
}

/** Maria's November, finished the way the cards do it: the sample, her costs, her tap. */
async function finishMariasMonth(maria) {
  const sample = await as(maria, () => addExampleSample(maria.context));
  const d = today();
  const proposed = await as(maria, () =>
    evidence.createEvidenceDraft(
      {
        fields: {
          kind: "income",
          organization: MARIA.delivery,
          start: `${current}-01`,
          end: d,
          income: {
            kind: "self-employment",
            receivedOn: d,
            grossPayCents: MARIA.sample.totalCents,
            netEarningsCents: MARIA.sample.totalCents - MARIA.sample.costsCents,
            costsConfirmed: true,
          },
        },
        documentId: sample.id,
      },
      maria.context,
      "agent",
    ),
  );
  await as(maria, () =>
    evidence.changeEvidenceRecord(
      "confirm",
      { id: proposed.id, version: proposed.version },
      maria.context,
    ),
  );
  return sample;
}

test("only the member, in their own browser, makes the packet", () => {
  assert.equal(action.agentTool, false);
  assert.equal(action.mcpTool, false);
  assert.equal(action.uiOnly, true);
  const path = "/_agent-native/actions/proof_packet";
  assert.equal(access.isAllowedRequest(path, "POST"), true);
  assert.equal(access.isExampleAllowedRequest(path, "POST"), true);
});

test("Maria's finished October: a cover page in plain words with the rule and a signature line", async () => {
  const maria = await openExample("maria", "198.51.100.91");
  const shown = await as(maria, () => exampleMonth(maria.context));
  assert.equal(shown.lastMonth.status, "Meets", "the example page shows October met");
  assert.equal(await as(maria, () => packets.packetMonth(maria.context)), previous);

  const packet = await as(maria, () =>
    packets.buildProofPacket({ month: previous, language: "en" }, maria.context),
  );
  assert.equal(packet.status, "Meets");
  assert.equal(packet.filename, `eighty-proof-${previous}.pdf`);
  const loaded = await PDFDocument.load(packet.pdf);
  assert.equal(loaded.getPageCount(), packet.pages);
  const cover = await textOf(packet.pdf);
  assert.match(cover, /Proof for the Medicaid work rule/);
  assert.match(cover, /Maria \(an example person, made up\)/);
  assert.match(cover, /Meets the rule/);
  assert.match(cover, new RegExp(shown.lastMonth.citation.replace(/[()]/g, "\\$&")));
  assert.match(cover, /84 of 80 hours/);
  assert.doesNotMatch(cover, /\$0\.00/, "a measure that did not count is not shown");
  assert.match(cover, /I confirm that this is true/);
  assert.match(cover, /Signature/);
  assert.match(cover, /The state makes the decision/);
  assert.match(packet.email.subject, /Medicaid work rule proof for/);
  assert.match(packet.email.body, /Meets the rule/);
});

test("Maria's November, finished through the cards: the packet carries her earnings summary, in Spanish too", async () => {
  const maria = await openExample("maria", "198.51.100.92");
  await assert.rejects(
    as(maria, () => packets.buildProofPacket({ month: current }, maria.context)),
    /meets the rule/,
    "no packet while the month is below the line",
  );
  await finishMariasMonth(maria);
  assert.equal(await as(maria, () => packets.packetMonth(maria.context)), current);

  const en = await as(maria, () =>
    packets.buildProofPacket({ month: current, language: "en" }, maria.context),
  );
  assert.equal(en.documents, 1);
  assert.ok(en.pages >= 2, "the cover, then the earnings summary");
  const cover = await textOf(en.pdf);
  assert.match(cover, /document 1, attached/);
  assert.match(cover, /\$617\.85 after costs/);
  assert.doesNotMatch(cover, /Volunteer service/, "met by pay: only the pay line is listed");
  assert.match(cover, /1 document is attached after this page/);
  const attached = await textOf(en.pdf, 2);
  assert.match(attached, /Document 1 of 1/);

  const es = await as(maria, () =>
    packets.buildProofPacket({ month: current, language: "es" }, maria.context),
  );
  assert.equal(es.filename, `eighty-prueba-${current}.pdf`);
  const portada = await textOf(es.pdf);
  assert.match(portada, /Prueba para la regla de trabajo de Medicaid/);
  assert.match(portada, /Cumple la regla/);
  assert.match(portada, /Firma/);
  assert.match(es.email.body, /Adjunto mi prueba/);

  // The browser gets the same PDF as base64.
  const web = await as(maria, () =>
    packets.proofPacket({ month: current, language: "en" }, maria.context),
  );
  assert.equal(Buffer.from(web.data, "base64").subarray(0, 5).toString(), "%PDF-");

  // Do my month points to it, on the web and in Telegram.
  const work = await as(maria, () => doMonth({ read: false }, maria.context));
  assert.equal(work.packet, current);
  assert.match(monthWorkText(work, "en"), /Send \/packet/);
});

test("Rosa: the rule does not apply, and the cover says why in plain words", async () => {
  const rosa = await openExample("rosa", "198.51.100.93");
  const month = await as(rosa, () => packets.packetMonth(rosa.context));
  assert.equal(month, current);
  const packet = await as(rosa, () =>
    packets.buildProofPacket({ month, language: "en" }, rosa.context),
  );
  assert.equal(packet.status, "Exempt");
  const cover = await textOf(packet.pdf);
  assert.match(cover, /The rule does not apply/);
  assert.match(cover, /family member who has a disability/);
  assert.match(cover, /435\.554/);
});

test("a member with nothing confirmed gets no packet, and a future month is refused", async () => {
  const member = await realMember("packet.member@example.test");
  assert.equal(await as(member, () => packets.packetMonth(member.context)), null);
  await assert.rejects(
    as(member, () => packets.buildProofPacket({ month: current }, member.context)),
    /meets the rule/,
  );
  await assert.rejects(
    as(member, () =>
      packets.buildProofPacket({ month: shiftMonth(current, 1) }, member.context),
    ),
    /past or current month/,
  );
});

const incoming = (chatId, rawText) => ({
  platform: "telegram",
  externalThreadId: `chat:${chatId}`,
  text: rawText,
  files: [],
  senderId: "99",
  platformContext: { chatId, chatType: "private", rawText, fileKind: null },
  timestamp: Date.now(),
});

test("/packet in Telegram sends the PDF itself to the linked chat", async () => {
  const maria = await openExample("maria", "198.51.100.94");
  const code = (await as(maria, () => telegramLink("code", maria.context))).code;
  await telegram.beforeTelegramMessage(incoming(3201, code));

  const realFetch = globalThis.fetch;
  const sent = [];
  // guard:allow-env-mutation — test process only: a token so the sender runs
  process.env.TELEGRAM_BOT_TOKEN = "123:test"; // guard:allow-env-credential — test process only: not a real token
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("/sendDocument")) {
      sent.push({ url: String(url), form: init.body });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return realFetch(url, init);
  };
  try {
    const reply = await telegram.beforeTelegramMessage(incoming(3201, "/packet"));
    assert.equal(reply.handled, true);
    assert.match(reply.responseText, /Here is your proof packet/);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].form.get("chat_id"), "3201");
    const file = sent[0].form.get("document");
    assert.equal(file.name, `eighty-proof-${previous}.pdf`);
    assert.equal(
      Buffer.from(await file.arrayBuffer()).subarray(0, 5).toString(),
      "%PDF-",
    );
  } finally {
    globalThis.fetch = realFetch;
    // guard:allow-env-mutation — test process only: restore
    delete process.env.TELEGRAM_BOT_TOKEN; // guard:allow-env-credential — test process only: restore
  }
});
