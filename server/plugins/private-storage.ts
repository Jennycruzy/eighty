import { ensureS3PrivateBlobProviders } from "@agent-native/core/private-blob";
import { defineNitroPlugin, startIntervalJob } from "@agent-native/core/server";

import { retryDocumentDeletions } from "../lib/document-deletions.ts";

export default defineNitroPlugin((app) => {
  ensureS3PrivateBlobProviders();
  const job = startIntervalJob(retryDocumentDeletions, {
    intervalMs: 60_000,
    leading: false,
    timeoutMs: 360_000,
    onError: () => {
      console.error("Private file deletion will be retried.");
    },
  });
  app.hooks.hook("close", () => job.stop());
});
