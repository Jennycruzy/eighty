import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { closeDbExec } from "@agent-native/core/db";
import { signedS3Request, signS3Request } from "@agent-native/core/file-upload";
import {
  ensureS3PrivateBlobProviders,
  getPrivateBlobStorageReadinessForRequest,
  putPrivateBlob,
  readPrivateBlob,
  deletePrivateBlob,
  getPrivateBlobReadUrl,
} from "@agent-native/core/private-blob";
import { decryptSecretValue } from "@agent-native/core/secrets/crypto";
import { readDeployCredentialEnv } from "@agent-native/core/server";

import "../server/plugins/agent-native-email-branding.ts";

const config = {
  endpoint: readDeployCredentialEnv("S3_ENDPOINT"),
  bucket: readDeployCredentialEnv("S3_BUCKET"),
  region: readDeployCredentialEnv("S3_REGION") || "auto",
  accessKeyId: readDeployCredentialEnv("S3_ACCESS_KEY_ID"),
  secretAccessKey: readDeployCredentialEnv("S3_SECRET_ACCESS_KEY"),
};
assert(
  config.endpoint &&
    config.bucket &&
    config.accessKeyId &&
    config.secretAccessKey,
  "Private storage settings are required.",
);
assert(
  config.bucket.startsWith("eighty-"),
  "This check may only write to an Eighty bucket.",
);
assert.equal(new URL(config.endpoint).protocol, "https:");
const receipt = {
  checkedOn: new Date().toISOString(),
  provider: null,
  applicationEncrypted: false,
  storedBytesDiffer: false,
  privateReadMatches: false,
  anonymousReadDenied: false,
  directLinkRefused: false,
  tamperedHandleRefused: false,
  deleteVerified: false,
};
let handle,
  descriptor,
  step = "storage readiness";
try {
  ensureS3PrivateBlobProviders();
  const ready = await getPrivateBlobStorageReadinessForRequest();
  assert.equal(ready.providerId, "s3-private");
  receipt.provider = ready.providerId;
  const original = Buffer.from(
    `Eighty synthetic storage check ${randomUUID()}`,
  );
  step = "upload a synthetic file";
  handle = await putPrivateBlob({
    data: original,
    filename: "storage-check.txt",
    mimeType: "text/plain",
  });
  assert(handle && handle.provider === "s3-private" && handle.opaque === true);
  assert(handle.id.startsWith("s3:v1:"));
  descriptor = JSON.parse(decryptSecretValue(handle.id.slice("s3:v1:".length)));
  assert.equal(descriptor.bucket, config.bucket);
  assert.equal(descriptor.endpoint, config.endpoint);
  receipt.applicationEncrypted = handle.encrypted === true;
  step = "read stored bytes";
  const raw = await signedS3Request(config, descriptor.key, {
    method: "GET",
    timeoutMs: 15000,
  });
  assert.equal(raw.status, 200);
  const stored = Buffer.from(await raw.arrayBuffer());
  receipt.storedBytesDiffer = !stored.equals(original);
  step = "read through private storage";
  const restored = await readPrivateBlob(handle);
  receipt.privateReadMatches = Buffer.from(restored.data).equals(original);
  step = "reject public access";
  const { url: address } = await signS3Request(config, descriptor.key, {
    method: "GET",
  });
  const anonymous = await fetch(address, {
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  receipt.anonymousStatus = anonymous.status;
  receipt.anonymousReadDenied = [400, 401, 403, 404].includes(anonymous.status);
  await anonymous.body?.cancel();
  receipt.directLinkRefused =
    (await getPrivateBlobReadUrl(handle, { expiresInSeconds: 60 })) === null;
  step = "reject a changed handle";
  const parts = handle.id.split(":");
  const ciphertext = parts[parts.length - 2];
  parts[parts.length - 2] =
    (ciphertext[0] === "0" ? "1" : "0") + ciphertext.slice(1);
  try {
    await readPrivateBlob({ ...handle, id: parts.join(":") });
  } catch (error) {
    receipt.tamperedHandleRefused = error?.kind === "corrupt";
  }
} catch {
  console.error(
    `FAIL Private storage check: ${step}. No credentials or document contents were printed.`,
  );
  process.exitCode = 1;
} finally {
  try {
    if (handle) {
      const deleted = await deletePrivateBlob(handle);
      assert.equal(deleted.deleted, true);
      const absent = await signedS3Request(config, descriptor.key, {
        method: "HEAD",
        timeoutMs: 15000,
      });
      receipt.deleteVerified = absent.status === 404;
      await absent.body?.cancel();
    }
  } catch {
    console.error(
      "FAIL Test-file cleanup needs attention; the private check did not claim deletion.",
    );
    process.exitCode = 1;
  }
  await closeDbExec();
  await mkdir(new URL("../.private/", import.meta.url), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(
    new URL("../.private/private-storage-result.json", import.meta.url),
    JSON.stringify(receipt, null, 2) + "\n",
    { mode: 0o600 },
  );
}
for (const [name, passed] of Object.entries(receipt)) {
  if (typeof passed === "boolean") {
    console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
    if (!passed) process.exitCode = 1;
  }
}
