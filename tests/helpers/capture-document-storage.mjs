// Only the disposable production check imports this file. Encryption stays in the real provider.
import assert from "node:assert/strict";
const actualFetch = globalThis.fetch,
  objects = new Map();
globalThis.fetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init);
  if (new URL(request.url).hostname !== "eighty-storage.example.test")
    return actualFetch(input, init);
  assert(request.headers.get("authorization")?.startsWith("AWS4-HMAC-SHA256 "));
  if (request.method === "PUT") {
    const data = Buffer.from(await request.arrayBuffer());
    assert(
      !data.subarray(0, 5).equals(Buffer.from("%PDF-")),
      "PDF bytes must be encrypted before upload",
    );
    assert(
      !(data[0] === 255 && data[1] === 216),
      "JPEG bytes must be encrypted before upload",
    );
    assert(
      !data.subarray(1, 4).equals(Buffer.from("PNG")),
      "PNG bytes must be encrypted before upload",
    );
    objects.set(request.url, data);
    return new Response(null, { status: 200 });
  }
  if (request.method === "GET") {
    const data = objects.get(request.url);
    return new Response(data || null, { status: data ? 200 : 404 });
  }
  if (request.method === "DELETE") {
    objects.delete(request.url);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 405 });
};
