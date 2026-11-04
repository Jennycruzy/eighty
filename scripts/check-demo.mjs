import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export async function checkDemo(baseUrl, sql) {
  const headers = {
    origin: baseUrl,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
  };
  const start = async () => {
    const response = await fetch(
      `${baseUrl}/_agent-native/actions/start_demo`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ person: "maria" }),
      },
    );
    assert.equal(response.status, 200, "Maria's demo must open");
    const result = await response.json();
    assert.match(result.ticket, /^[A-Za-z0-9_-]{43}$/);
    const hash = createHash("sha256").update(result.ticket).digest("hex");
    const [account] =
      await sql`SELECT user_id FROM eighty_demo_accounts WHERE ticket_hash = ${hash}`;
    assert(account?.user_id);
    return { ...result, userId: account.user_id };
  };
  const enter = (ticket) =>
    fetch(`${baseUrl}/enter-demo`, {
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
  const response = await fetch(`${baseUrl}/_agent-native/actions/demo_month`, {
    headers: { ...headers, cookie },
  });
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
  console.log(
    "PASS Maria's demo opens on PostgreSQL, counts 61 of 80 hours, uses each ticket once, creates separate accounts and refuses private routes.",
  );
}
