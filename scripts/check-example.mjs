import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export async function checkExample(baseUrl, sql) {
  const headers = {
    origin: baseUrl,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  };
  const start = async () => {
    const response = await fetch(
      `${baseUrl}/_agent-native/actions/start_example`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ person: "maria" }),
      },
    );
    assert.equal(response.status, 200, "Maria's example must open");
    const result = await response.json();
    assert.match(result.ticket, /^[A-Za-z0-9_-]{43}$/);
    const hash = createHash("sha256").update(result.ticket).digest("hex");
    const [account] =
      await sql`SELECT user_id FROM eighty_demo_accounts WHERE ticket_hash = ${hash}`;
    assert(account?.user_id);
    return { ...result, userId: account.user_id };
  };
  const enter = (ticket) =>
    fetch(`${baseUrl}/enter-example`, {
      method: "POST",
      headers,
      body: JSON.stringify({ ticket }),
    });
  const first = await start();
  const entered = await enter(first.ticket);
  assert.equal(entered.status, 200);
  const cookie = entered.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert(cookie);
  const response = await fetch(
    `${baseUrl}/_agent-native/actions/example_month`,
    {
      headers: { ...headers, cookie },
    },
  );
  assert.equal(response.status, 200);
  const month = await response.json();
  assert.equal(month.person, "maria");
  assert.equal(month.thisMonth.status, "Short");
  assert.equal(month.thisMonth.hours, 61);
  assert.equal(month.thisMonth.targetHours, 80);
  assert.equal(month.lastMonth.status, "Meets");
  assert.equal((await enter(first.ticket)).status, 410);
  const second = await start();
  assert.notEqual(first.userId, second.userId);
  for (const [path, method] of [
    ["/_agent-native/actions/prepare_member_account", "POST"],
    ["/_agent-native/actions/finish_member_account", "POST"],
    ["/settings", "GET"],
    ["/navigator", "GET"],
    ["/admin", "GET"],
    ["/_agent-native/agent-chat", "POST"],
    ["/_agent-native/mcp", "POST"],
    ["/_agent-native/auth/ba/change-email", "POST"],
    ["/_agent-native/auth/ba/update-user", "POST"],
  ]) {
    const refused = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { ...headers, cookie },
      ...(method === "POST" ? { body: "{}" } : {}),
      redirect: "manual",
    });
    assert(
      [403, 404].includes(refused.status),
      `${method} ${path}: ${refused.status}`,
    );
  }
  const browser = await chromium.launch({ headless: true });
  try {
    for (const lang of ["en", "es"]) {
      const page = await browser.newPage({
        viewport: { width: 360, height: 640 },
      });
      await page.goto(`${baseUrl}/?lang=${lang}`);
      await page
        .getByRole("button", {
          name: lang === "es" ? "Mira el mes de María" : "See Maria's month",
          exact: true,
        })
        .click();
      await page.waitForURL(/\/example/);
      await page.locator(".example-notice").waitFor();
      assert.match(
        await page.locator(".example-notice").innerText(),
        lang === "es" ? /persona de ejemplo/ : /example person/,
      );
      assert.equal(await page.locator(".example-band").count(), 0);
      await page
        .getByRole("button", {
          name: lang === "es" ? "Preguntar sobre mi mes" : "Ask about my month",
          exact: true,
        })
        .click();
      await page
        .locator("#month-question")
        .fill(
          lang === "es"
            ? "¿Qué falta en mi mes?"
            : "What is missing from my month?",
        );
      await page
        .getByRole("button", {
          name: lang === "es" ? "Preguntar" : "Ask",
          exact: true,
        })
        .click();
      await page
        .locator(".month-helper [role=alert]")
        .waitFor({ timeout: 45000 });
      assert.match(
        await page.locator(".month-helper [role=alert]").innerText(),
        lang === "es"
          ? /ayuda.*no.*disponible|descansa/
          : /helper.*not available|resting/,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const former = "/\x64emo";
  for (const path of [former, `${former}.data`]) {
    const response = await fetch(`${baseUrl}${path}?lang=es&person=rosa`, {
      redirect: "manual",
    });
    assert.equal(response.status, 301);
    assert.equal(
      response.headers.get("location"),
      "/example?lang=es&person=rosa",
    );
  }
  console.log(
    "PASS Home page opens the example, shows its quiet note, opens the helper on a phone and refuses a turn plainly without a model.",
  );
  console.log(
    "PASS Maria's example opens on PostgreSQL, counts 61 of 80 hours, uses each ticket once, creates separate accounts and refuses private routes.",
  );
}
