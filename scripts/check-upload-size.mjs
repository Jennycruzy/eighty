import assert from "node:assert/strict";
import { request } from "node:https";

import { MAX_UPLOAD_REQUEST_BYTES } from "../shared/document-upload.ts";
export async function checkUploadSize(context, baseURL) {
  const origin = new URL(baseURL);
  assert.match(origin.href, /^https:\/\/eighty\.example\.test:\d+\/$/);
  const cookie = (await context.cookies())
    .map((value) => `${value.name}=${value.value}`)
    .join("; ");
  for (const name of ["upload_document", "inspect_document"]) {
    const status = await new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port: origin.port,
          servername: origin.hostname,
          rejectUnauthorized: false,
          method: "POST",
          path: `/_agent-native/actions/${name}`,
          headers: {
            host: origin.host,
            cookie,
            "content-type": "application/json",
            "content-length": String(MAX_UPLOAD_REQUEST_BYTES + 1),
          },
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
            `${name} did not reject oversized headers before reading the body`,
          ),
        );
      });
      req.on("error", () =>
        reject(new Error(`${name}: size-limit connection failed`)),
      );
      req.flushHeaders(); // No body bytes are sent. Waiting for JSON here must fail this check.
    });
    assert.equal(
      status,
      413,
      `${name} must refuse the declared size before reading any body`,
    );
  }
  console.log(
    "PASS Both signed-in upload actions return 413 from headers without receiving body bytes.",
  );
}
