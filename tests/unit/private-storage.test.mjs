import assert from "node:assert/strict";
import test from "node:test";

import {
  registerFileUploadProvider,
  unregisterFileUploadProvider,
} from "@agent-native/core/file-upload";
import {
  getPrivateBlobStorageReadinessForRequest,
  putPrivateBlob,
  ensureS3PrivateBlobProviders,
} from "@agent-native/core/private-blob";

import "../../server/plugins/agent-native-email-branding.ts";

test("missing private storage never sends document bytes to a public uploader", async () => {
  ensureS3PrivateBlobProviders();
  let publicWrites = 0;
  registerFileUploadProvider({
    id: "eighty-public-upload-check",
    name: "Test uploader",
    isConfigured: () => true,
    isConfiguredForRequest: async () => true,
    upload: async () => {
      publicWrites += 1;
      throw new Error("Document bytes reached a public uploader.");
    },
  });
  try {
    assert.deepEqual(await getPrivateBlobStorageReadinessForRequest(), {
      configured: false,
      providerId: null,
    });
    await assert.rejects(
      putPrivateBlob({
        data: Buffer.from("Synthetic document"),
        filename: "proof.txt",
        mimeType: "text/plain",
      }),
      (error) => error.kind === "not_configured",
    );
    assert.equal(publicWrites, 0);
  } finally {
    unregisterFileUploadProvider("eighty-public-upload-check");
  }
});
