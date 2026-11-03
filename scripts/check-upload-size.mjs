import assert from "node:assert/strict";
import { request } from "node:https";

import { expect } from "@playwright/test";

import { MAX_UPLOAD_REQUEST_BYTES } from "../shared/document-upload.ts";

const ACTIONS = ["upload_document", "inspect_document"];
// Body framing is set per request below; every other header is kept as the page sent it.
const FRAMING_HEADERS = new Set(["content-length", "transfer-encoding"]);

// Send one raw request. With `body` null, only the headers are sent and the
// request must be answered without the server waiting for body bytes.
function send(origin, name, headers, body) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port: origin.port,
        servername: origin.hostname,
        rejectUnauthorized: false,
        method: "POST",
        path: `/_agent-native/actions/${name}`,
        headers,
      },
      (response) => {
        response.resume();
        response.once("end", () => {
          req.destroy();
          resolve(response.statusCode);
        });
      },
    );
    req.setTimeout(10000, () => {
      req.destroy();
      reject(
        new Error(
          body === null
            ? `${name} did not answer within 10 seconds from headers alone`
            : `${name} did not answer a small request within 10 seconds`,
        ),
      );
    });
    req.on("error", (error) =>
      reject(new Error(`${name}: size-limit connection failed: ${error.code}`)),
    );
    if (body === null) {
      req.flushHeaders(); // No body bytes are sent. Waiting for JSON here must fail this check.
    } else {
      req.end(body);
    }
  });
}

// Have the signed-in page make one real inspect_document call and keep the
// headers it sent, so the raw requests below carry the page's own proof.
async function capturePageRequest(session, baseURL, choose, photo) {
  const { page } = session;
  await page.goto(`${baseURL}/add?lang=en`);
  const fileInput = page.getByLabel("Choose a file");
  await fileInput.waitFor();
  await fileInput.setInputFiles({
    name: "size-check.png",
    mimeType: "image/png",
    buffer: photo,
  });
  const sent = page.waitForRequest(
    (value) =>
      value.method() === "POST" &&
      new URL(value.url()).pathname ===
        "/_agent-native/actions/inspect_document",
  );
  const check = page.getByRole("button", { name: "Check file", exact: true });
  await expect(check).toBeEnabled({ timeout: 30000 });
  await choose(page, check, "Enter");
  const pageRequest = await sent;
  const pageResponse = await pageRequest.response();
  assert(pageResponse, "The page's inspect_document call got no response.");
  assert.equal(
    pageResponse.status(),
    200,
    "The page's own inspect_document call must be accepted before its headers are reused.",
  );
  await page
    .getByRole("button", { name: "Retake or choose another file" })
    .waitFor();
  const captured = {};
  for (const [name, value] of Object.entries(await pageRequest.allHeaders())) {
    const key = name.toLowerCase();
    assert(
      !key.startsWith(":"),
      `Unexpected pseudo-header ${key} in the page request.`,
    );
    if (!FRAMING_HEADERS.has(key)) captured[key] = value;
  }
  assert(captured.cookie, "The page request must carry its session cookie.");
  return captured;
}

export async function checkUploadSize(session, baseURL, choose, photo) {
  const origin = new URL(baseURL);
  assert.match(origin.href, /^https:\/\/eighty\.example\.test:\d+\/$/);
  const proof = await capturePageRequest(session, baseURL, choose, photo);
  const cookie = (await session.context.cookies())
    .map((value) => `${value.name}=${value.value}`)
    .join("; ");
  const oversized = String(MAX_UPLOAD_REQUEST_BYTES + 1);
  const small = Buffer.from(
    JSON.stringify({
      data: photo.toString("base64"),
      rotation: 0,
      acceptQuality: false,
    }),
  );
  assert(small.length <= MAX_UPLOAD_REQUEST_BYTES);
  // The dark photo is valid input: inspection reports its quality, and saving
  // refuses it without acceptQuality, so no file is written by this check.
  const accepted = { inspect_document: 200, upload_document: 422 };
  for (const name of ACTIONS) {
    const withoutProof = await send(
      origin,
      name,
      {
        host: origin.host,
        cookie,
        "content-type": "application/json",
        "content-length": oversized,
      },
      null,
    );
    assert.equal(
      withoutProof,
      403,
      `${name}: an oversized request without the page's proof must be refused with 403 before the body is read`,
    );
    const tooLarge = await send(
      origin,
      name,
      { ...proof, "content-length": oversized },
      null,
    );
    assert.equal(
      tooLarge,
      413,
      `${name}: an oversized request with the page's proof must be refused with 413 before any body is read`,
    );
    const withinLimit = await send(
      origin,
      name,
      { ...proof, "content-length": String(small.length) },
      small,
    );
    assert.notEqual(
      withinLimit,
      413,
      `${name}: a small request with the page's proof must not be refused for size`,
    );
    assert.equal(
      withinLimit,
      accepted[name],
      `${name}: a small request with the page's proof must reach the action`,
    );
  }
  console.log(
    `PASS Both upload actions return 413 from headers alone with the signed-in page's request headers (${Object.keys(proof).sort().join(", ")}), 403 without them, and accept a small body.`,
  );
}
