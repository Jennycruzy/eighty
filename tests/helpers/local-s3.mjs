// Tests only: a local S3 transport that records bytes. Encryption, signing and
// decryption are the framework's real private storage code.
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

export async function startLocalS3() {
  const objects = new Map();
  let writes = 0;
  const server = createServer(async (request, response) => {
    if (!request.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ")) {
      response.writeHead(403);
      response.end();
      return;
    }
    if (request.method === "PUT") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      objects.set(request.url, Buffer.concat(chunks));
      writes += 1;
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
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    env: {
      S3_ENDPOINT: `http://127.0.0.1:${server.address().port}`,
      S3_BUCKET: "eighty-reader-checks",
      S3_REGION: "auto",
      S3_ACCESS_KEY_ID: "test-access-key",
      S3_SECRET_ACCESS_KEY: "test-secret-key",
      S3_PUBLIC_BASE_URL: "",
      R2_PUBLIC_BASE_URL: "",
      SECRETS_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    },
    objects,
    writes: () => writes,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
