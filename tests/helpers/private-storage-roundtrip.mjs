import { closeDbExec } from "@agent-native/core/db";
import {
  ensureS3PrivateBlobProviders,
  setPrivateBlobPublicUploadFallbackEnabled,
  putPrivateBlob,
  readPrivateBlob,
  deletePrivateBlob,
  getPrivateBlobReadUrl,
} from "@agent-native/core/private-blob";
setPrivateBlobPublicUploadFallbackEnabled(false);
ensureS3PrivateBlobProviders();
let handle;
try {
  const original = Buffer.from("Synthetic private storage regression document");
  handle = await putPrivateBlob({ data: original, mimeType: "text/plain" });
  if (!handle) throw new Error("Private storage is unavailable in the test.");
  const restored = await readPrivateBlob(handle);
  const direct = await getPrivateBlobReadUrl(handle, { expiresInSeconds: 60 });
  console.log(
    JSON.stringify({
      encrypted: handle.encrypted,
      roundTrip: Buffer.from(restored.data).equals(original),
      refusedLink: direct === null,
    }),
  );
} finally {
  if (handle) await deletePrivateBlob(handle);
  await closeDbExec();
}
