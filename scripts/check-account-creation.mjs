import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import { getDbExec, closeDbExec } from "@agent-native/core/db";
import {
  decryptSecretValue,
  encryptSecretValue,
} from "@agent-native/core/secrets/crypto";
import { chromium } from "@playwright/test";

import { checkEvidenceBrowser } from "./check-evidence-browser.mjs";
import "../server/plugins/agent-native-email-branding.ts";
const execute = promisify(execFile);
const [runId, container, baseURL] = process.argv.slice(2);
assert.match(runId || "", /^eighty-check-[a-f0-9-]+$/);
assert.equal(container, `${runId}-accounts`);
assert.match(baseURL || "", /^https:\/\/eighty\.example\.test:\d+$/);
const marker = await getDbExec().execute({
  sql: "SELECT id FROM eighty_deploy_check WHERE id=?",
  args: [runId],
});
assert.equal(marker.rows[0]?.id, runId);
const browser = await chromium.launch({
  headless: true,
  args: [
    "--host-resolver-rules=MAP eighty.example.test 127.0.0.1",
    "--no-proxy-server",
  ],
});
const sessions = [];
// Names the check in progress, so a failure reports where it happened.
let current = "start the browser checks";
async function tabTo(page, locator) {
  for (let count = 0; count < 70; count++) {
    if (await locator.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  assert.fail("The keyboard could not reach a required control.");
}
async function choose(page, locator, key) {
  await tabTo(page, locator);
  await page.keyboard.press(key);
}
async function next(page, es) {
  await choose(
    page,
    page.getByRole("button", { name: es ? "Seguir" : "Next", exact: true }),
    "Enter",
  );
}
async function mailFor(email) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const { stdout } = await execute("docker", [
      "exec",
      container,
      "node",
      "--input-type=module",
      "-e",
      `import fs from 'node:fs';const messages=fs.readdirSync('/tmp').filter(name=>name.startsWith('eighty-account-mail-')).map(name=>JSON.parse(fs.readFileSync('/tmp/'+name)));console.log(JSON.stringify(messages));`,
    ]);
    const mail = JSON.parse(stdout).find((m) =>
      (Array.isArray(m.to) ? m.to : [m.to]).includes(email),
    );
    if (mail) return mail;
    await delay(200);
  }
  assert.fail(
    "Verification mail was not captured by the disposable transport.",
  );
}
function verifyURL(mail) {
  const links = [...(mail.html || "").matchAll(/href="([^"]+)"/g)].map(
    (match) => match[1].replaceAll("&amp;", "&"),
  );
  const link = links.find((url) => url.includes("verify-email"));
  assert(link, "The email must contain a real verification link.");
  const url = new URL(link);
  assert.equal(
    url.origin,
    baseURL,
    "The verification link must stay on the disposable app.",
  );
  return url.toString();
}
try {
  for (const lang of ["en", "es"]) {
    const es = lang === "es",
      email = `${runId}-${lang}@example.test`;
    current = `${lang} account creation`;
    const context = await browser.newContext({
      viewport: { width: 360, height: 640 },
      locale: lang === "es" ? "en-US" : "es-US",
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const errors = [];
    const failedRequests = [];
    page.on("response", async (response) => {
      if (
        response.status() < 400 ||
        !response.url().includes("/_agent-native/")
      )
        return;
      let code = "";
      try {
        const body = await response.json();
        code = String(
          body.code || body.errorCode || body.statusMessage || body.error || "",
        ).slice(0, 180);
      } catch {}
      failedRequests.push({
        path: new URL(response.url()).pathname,
        status: response.status(),
        code,
      });
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(baseURL + `/check?lang=${lang}`);
    // Every interaction below uses the keyboard, including both account pages.
    await tabTo(page, page.locator("#state"));
    await page.keyboard.press("n");
    assert.equal(await page.locator("#state").inputValue(), "NE");
    await next(page, es);
    await tabTo(page, page.locator('input[name="group"]:checked'));
    await page.keyboard.press("ArrowDown");
    assert.equal(
      await page.locator('input[name="group"]:checked').inputValue(),
      "expansion",
    );
    await next(page, es);
    if (es) {
      await choose(
        page,
        page.locator('input[name="otherGroup"]:checked'),
        "Space",
      );
    } else {
      await tabTo(page, page.locator('input[name="otherGroup"]:checked'));
      await page.keyboard.press("ArrowUp");
    }
    await next(page, es);
    await tabTo(page, page.locator("#age"));
    await page.keyboard.type("34");
    await next(page, es);
    for (let currentCheck = 2; currentCheck < 13; currentCheck++) {
      await tabTo(page, page.locator("input[type=radio]:checked"));
      await page.keyboard.press("ArrowUp"); // unknown -> no
      await next(page, es);
    }
    assert.equal(
      await page.locator(".result").getAttribute("data-outcome"),
      "conditional",
    );
    await choose(
      page,
      page.getByRole("link", {
        name: es ? "Seguir mis meses" : "Track my months",
        exact: true,
      }),
      "Enter",
    );
    await page.waitForURL(/\/check\/account/);
    await page.locator("#email").waitFor();
    assert((await page.locator("dl").innerText()).includes("34"));
    await tabTo(page, page.locator("#email"));
    await page.keyboard.type(email);
    const password = `Test-account-${runId}`;
    await tabTo(page, page.locator("#password"));
    await page.keyboard.type(password);
    await choose(page, page.getByRole("checkbox"), "Space");
    await choose(
      page,
      page.getByRole("button", {
        name: es ? "Crear cuenta" : "Create account",
        exact: true,
      }),
      "Enter",
    );
    const submitted = page.getByRole("heading", {
      name: es ? "Revisa tu correo" : "Check your email",
      exact: true,
    });
    await Promise.race([
      submitted.waitFor(),
      page.getByRole("alert").waitFor(),
    ]);
    assert(
      await submitted.isVisible(),
      `Account submission failed: ${JSON.stringify(failedRequests)}; browser errors: ${JSON.stringify(errors)}`,
    );
    const before = await getDbExec().execute({
      sql: "SELECT id FROM eighty_members WHERE owner_email=?",
      args: [email],
    });
    assert.equal(
      before.rows.length,
      0,
      "Unverified accounts must not save the carried answers.",
    );
    const mail = await mailFor(email);
    let verification = verifyURL(mail);
    const token = new URL(verification).searchParams.get("token");
    const tokenData = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    assert.equal(
      tokenData.exp - tokenData.iat,
      24 * 60 * 60,
      "Verification lasts 24 hours",
    );
    assert.match(mail.text || mail.html, /This link works for 24 hours\./);
    assert.doesNotMatch(mail.html, /alt="Eighty"/);
    const callback = new URL(verification).searchParams.get("callbackURL");
    assert(callback, "Verification must carry the account callback.");
    const draft = new URL(callback).searchParams.get("draft");
    assert(draft);
    assert(
      !callback.includes("%22state%22") && !callback.includes("health="),
      "Answers must not be readable in the link.",
    );
    const denied = await page.evaluate(async (draft) => {
      const response = await fetch(
        "/_agent-native/actions/finish_member_account",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ draft }),
        },
      );
      return response.status;
    }, draft);
    assert(
      [401, 403].includes(denied),
      "Unverified accounts cannot claim a draft.",
    );
    const expiredAnswers = JSON.parse(decryptSecretValue(draft));
    expiredAnswers.expires = 1;
    const expiredDraft = encryptSecretValue(JSON.stringify(expiredAnswers));
    await getDbExec().execute({
      sql: "UPDATE eighty_registration_mail SET draft = ? WHERE address_hash = ?",
      args: [
        expiredDraft,
        (await import("../server/lib/registration.ts")).registrationAddressHash(
          email,
        ),
      ],
    });
    await page.goto(
      `${baseURL}/check/account?lang=${lang}&draft=${encodeURIComponent(expiredDraft)}&error=TOKEN_EXPIRED`,
    );
    const resend = page.locator("form").filter({
      has: page.getByRole("button", {
        name: es ? "Envíame un enlace nuevo" : "Send me a new link",
        exact: true,
      }),
    });
    if (await resend.locator("input").count())
      await resend.locator("input").fill(email);
    await resend
      .getByRole("button", {
        name: es ? "Envíame un enlace nuevo" : "Send me a new link",
      })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: es ? "cuenta pendiente" : "account waiting" })
      .waitFor();
    let freshMail;
    for (let attempt = 0; attempt < 30; attempt++) {
      const all = await execute("docker", [
        "exec",
        container,
        "node",
        "--input-type=module",
        "-e",
        `import fs from 'node:fs'; const files=fs.readdirSync('/tmp').filter(name=>name.startsWith('eighty-account-mail-')); console.log(JSON.stringify(files.map(name=>JSON.parse(fs.readFileSync('/tmp/'+name)))));`,
      ]);
      freshMail = JSON.parse(all.stdout).find(
        (item) =>
          (Array.isArray(item.to) ? item.to : [item.to]).includes(email) &&
          verifyURL(item) !== verification,
      );
      if (freshMail) break;
      await delay(200);
    }
    assert(freshMail, "A fresh verification link was sent");
    verification = verifyURL(freshMail);
    // A new link carries a same-site return path rather than a full address.
    const renewedDraft = new URL(
      new URL(verification).searchParams.get("callbackURL"),
      baseURL,
    ).searchParams.get("draft");
    assert.deepEqual(
      JSON.parse(decryptSecretValue(renewedDraft)).profile,
      expiredAnswers.profile,
    );
    await page.goto(verification);
    await page.locator("button").waitFor();
    assert(
      (await page.locator("html").getAttribute("lang")).startsWith(lang),
      "Verification must use the browser's language.",
    );
    await choose(page, page.locator("button"), "Enter");
    await page
      .getByRole("heading", {
        name: es ? "Tu correo está verificado" : "Your email is verified",
        exact: true,
      })
      .waitFor();
    assert(
      (await page.locator(".result").innerText()).includes(
        es ? "Guardamos tus respuestas" : "Your answers are saved",
      ),
    );
    assert(
      !page.url().includes("draft="),
      "The claimed token must leave the address bar.",
    );
    const rows = await getDbExec().execute({
      sql: 'SELECT m.user_id,m.state_code,m.language,m.screener,u.email_verified FROM eighty_members m JOIN "user" u ON u.id=m.user_id WHERE m.owner_email=?',
      args: [email],
    });
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.rows[0].state_code, "NE");
    assert.equal(rows.rows[0].language, `${lang}-US`);
    assert.equal(rows.rows[0].screener.child, "no");
    assert.equal(rows.rows[0].screener.group, "expansion");
    assert.equal(rows.rows[0].screener.otherGroup, es ? "unknown" : "no");
    assert.equal(rows.rows[0].email_verified, true);
    const credentials = await getDbExec().execute({
      sql: 'SELECT password FROM "account" WHERE user_id=? AND provider_id=?',
      args: [rows.rows[0].user_id, "credential"],
    });
    assert(
      credentials.rows[0].password && credentials.rows[0].password !== password,
      "Passwords must be hashed.",
    );
    assert.deepEqual(errors, [], "No browser errors during account creation.");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      "No horizontal overflow on a phone.",
    );
    sessions.push({ page, context, email, draft, password });
    console.log(
      `PASS ${lang}: keyboard-only screener → account → captured verification → saved answers, with a real hashed password and verified identity.`,
    );
  }
  await checkEvidenceBrowser(sessions, baseURL, choose, (name) => {
    current = name;
  });
  current = "refusal of wrong-account, expired and changed links";
  // A different signed-in person cannot claim the other account's draft.
  const own = sessions[0],
    other = sessions[1];
  await own.page.goto(
    baseURL + "/check/account?draft=" + encodeURIComponent(other.draft),
  );
  await own.page.getByRole("alert").waitFor();
  const expired = JSON.parse(decryptSecretValue(own.draft));
  expired.expires = 1;
  await own.page.goto(
    baseURL +
      "/check/account?draft=" +
      encodeURIComponent(encryptSecretValue(JSON.stringify(expired))),
  );
  await own.page.getByRole("alert").waitFor();
  await own.page.goto(
    baseURL +
      "/check/account?draft=" +
      encodeURIComponent(
        own.draft.slice(0, -1) + (own.draft.endsWith("0") ? "1" : "0"),
      ),
  );
  await own.page.getByRole("alert").waitFor();
  const replacement = JSON.parse(decryptSecretValue(own.draft));
  replacement.profile.screener.age = "51";
  replacement.expires = Date.now() + 60000;
  await own.page.goto(
    baseURL +
      "/check/account?draft=" +
      encodeURIComponent(encryptSecretValue(JSON.stringify(replacement))),
  );
  await own.page
    .getByRole("heading", { name: "Your email is verified", exact: true })
    .waitFor();
  const kept = await getDbExec().execute({
    sql: "SELECT screener FROM eighty_members WHERE owner_email=?",
    args: [own.email],
  });
  assert.equal(kept.rows[0].screener.age, "34");
  console.log(
    "PASS Wrong-account, expired and changed links are refused; existing profile answers are kept.",
  );
} catch (error) {
  const firstLine =
    String(error?.message ?? error)
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? "unknown error";
  console.error(`CHECK FAILED: ${current}: ${firstLine}`);
  for (const [index, session] of sessions.entries()) {
    console.error(`Evidence browser ${index}: ${session.page.url()}`);
    console.error(
      (await session.page.locator("main").innerText()).slice(0, 6000),
    );
    await session.page.screenshot({
      path: `.private/evidence-failure-${index}.png`,
      fullPage: true,
    });
  }
  throw error;
} finally {
  await browser.close();
  await closeDbExec();
}
