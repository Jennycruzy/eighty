import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PUBLIC_PAGES, isMemberPage } from "../shared/access.ts";
import { checkPublicIndex } from "./check-public-index.mjs";
const states = JSON.parse(
  await readFile(new URL("../data/states.json", import.meta.url), "utf8"),
);
export async function checkPublicPages(baseUrl) {
  await checkPublicIndex(baseUrl);
  let count = 0;
  for (const path of [
    ...PUBLIC_PAGES,
    ...states.map((state) => `/states/${state.code.toLowerCase()}`),
  ]) {
    for (const lang of ["en", "es"]) {
      const response = await fetch(`${baseUrl}${path}?lang=${lang}`, {
        redirect: "manual",
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(
        response.status,
        200,
        `Signed-out ${path} (${lang}) must load, got ${response.status}`,
      );
      const body = await response.text();
      assert.match(body, /<main\b/, `${path} must render its own content`);
      assert.match(
        body,
        new RegExp(`<html[^>]*lang="${lang}-US"`),
        `${path} must set the page language`,
      );
      assert.doesNotMatch(
        body,
        /id="sign-in-form"|You are the Chat app agent|data-testid="chat-input"/,
      );
      assert(
        !response.headers.get("location"),
        `${path} must not redirect to login`,
      );
      count++;
    }
  }
  for (const path of [
    "/.dockerignore",
    "/.git/config",
    "/.env.production",
    "/home",
    "/chat",
    "/chat/test",
    "/agent",
    "/terminal",
    "/database",
    "/extensions",
    "/observability",
    "/team",
    "/settings/agent",
    "/_agent-native/actions/hello",
    "/_agent-native/terminal",
    "/_agent-native/chat",
    "/_agent-native/auth/signin",
    "/sign-in",
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    assert(
      isMemberPage(path)
        ? response.status === 302 &&
            new URL(response.headers.get("location"), baseUrl).pathname ===
              "/check/sign-in"
        : [401, 403, 404].includes(response.status),
      `Starter path ${path} must be closed, got ${response.status}`,
    );
  }
  const signup = await fetch(`${baseUrl}/_agent-native/auth/ba/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl },
    body: JSON.stringify({
      email: "closed-signup@example.test",
      password: "NotARealMemberPassword123!",
      name: "Closed sign-up check",
    }),
    signal: AbortSignal.timeout(10000),
  });
  assert(
    [403, 404, 503].includes(signup.status),
    `Public sign-up must stay closed, got ${signup.status}`,
  );
  for (const path of [
    "/add",
    "/review",
    "/add.data",
    "/example.data",
    "/review.data",
    "/_agent-native/actions/list_evidence",
    "/_agent-native/actions/list_documents",
    "/months",
    "/months/2026-11",
    "/navigator",
    "/admin",
    "/proof/packets",
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      headers: { accept: "text/html" },
      signal: AbortSignal.timeout(10000),
    });
    assert(
      path.endsWith(".data") || path.startsWith("/_agent-native/")
        ? response.status === 401
        : response.status === 302 &&
            new URL(response.headers.get("location"), baseUrl).pathname ===
              "/check/sign-in",
      `${path} must require an account, got ${response.status}`,
    );
    if (response.status === 302)
      assert.match(
        response.headers.get("cache-control"),
        /private, no-store/,
        path,
      );
    if (path.endsWith(".data") || path.startsWith("/_agent-native/"))
      assert.match(response.headers.get("content-type"), /application\/json/);
  }
  const deniedAction = await fetch(
    `${baseUrl}/_agent-native/actions/confirm_evidence`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseUrl,
        "sec-fetch-site": "same-origin",
      },
      body: "{}",
      redirect: "manual",
    },
  );
  assert.equal(deniedAction.status, 401);
  assert.match(deniedAction.headers.get("content-type"), /application\/json/);
  for (const lang of ["en", "es"]) {
    const response = await fetch(`${baseUrl}/example?lang=${lang}`, {
      redirect: "manual",
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 302);
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    const target = new URL(response.headers.get("location"), baseUrl);
    assert.equal(target.pathname, "/");
    assert.equal(target.searchParams.get("lang"), lang);
    assert.equal(target.hash, "#example-start-title");
    const home = await fetch(target);
    assert.match(await home.text(), /id="example-start-title"/);
  }
  console.log(
    "PASS Signed-out example links open the home page example button in English and Spanish.",
  );
  for (const path of ["/proof/answer-key.md", "/proof/answer-cases.json"]) {
    const response = await fetch(`${baseUrl}${path}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    assert.equal(
      response.status,
      200,
      `Public proof download ${path} must load`,
    );
  }
  console.log(
    `PASS ${count} signed-out page loads, starter routes closed, sign-up closed, member pages protected.`,
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  assert(process.argv[2], "Supply the test server URL");
  await checkPublicPages(process.argv[2]);
}
