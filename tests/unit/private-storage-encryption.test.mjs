import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
const execute = promisify(execFile);
test("Private buckets receive encrypted bytes and never issue a direct read link", async () => {
  const directory = await mkdtemp(join(tmpdir(), "eighty-storage-check-"));
  const objects = new Map();
  let uploaded;
  // This local S3 transport records bytes; encryption and decryption are the real framework code.
  const server = createServer(async (request, response) => {
    if (!request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ")) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (request.method === "PUT") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      uploaded = Buffer.concat(chunks);
      objects.set(request.url, uploaded);
      response.writeHead(200);
      response.end();
      return;
    }
    if (request.method === "GET") {
      const data = objects.get(request.url);
      response.writeHead(data ? 200 : 404);
      response.end(data);
      return;
    }
    if (request.method === "DELETE") {
      objects.delete(request.url);
      response.writeHead(204);
      response.end();
      return;
    }
    response.writeHead(405);
    response.end();
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { stdout } = await execute(
      process.execPath,
      [
        fileURLToPath(
          new URL("../helpers/private-storage-roundtrip.mjs", import.meta.url),
        ),
      ],
      {
        cwd: directory,
        timeout: 45000,
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: "",
          NETLIFY_DATABASE_URL: "",
          S3_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
          S3_BUCKET: "eighty-storage-regression",
          S3_REGION: "auto",
          S3_ACCESS_KEY_ID: "test-access-key",
          S3_SECRET_ACCESS_KEY: "test-secret-key",
          S3_PUBLIC_BASE_URL: "",
          R2_PUBLIC_BASE_URL: "",
          SECRETS_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
        },
      },
    );
    const line = stdout
      .trim()
      .split("\n")
      .findLast((value) => value.startsWith("{"));
    assert(line, "The real framework round trip must return a result.");
    const result = JSON.parse(line);
    assert.equal(
      result.roundTrip,
      true,
      "Private reads must restore the original bytes.",
    );
    assert.equal(objects.size, 0, "The provider must delete the test object.");
    assert(uploaded, "An actual HTTP upload must have happened.");
    assert.equal(
      uploaded.equals(
        Buffer.from("Synthetic private storage regression document"),
      ),
      false,
      "A private bucket must not receive plaintext document bytes.",
    );
    assert.equal(result.encrypted, true);
    assert.equal(result.refusedLink, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
