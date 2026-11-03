import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { inspectDocument } from "../../server/lib/document-content.ts";
import { documentUpload } from "../../shared/document-upload.ts";
const fixture = await readFile(
  new URL("../fixtures/documents/pay.png", import.meta.url),
);
test("Photos are bounded, auto-oriented and stripped of metadata; original bytes stay unchanged", async () => {
  const original = await sharp(fixture)
      .resize(3600, 4800)
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer(),
    copy = Buffer.from(original);
  const result = await inspectDocument(original, 0),
    meta = await sharp(Buffer.from(result.preview, "base64")).metadata();
  assert.equal(meta.width, 2400);
  assert.equal(meta.height, 1800);
  assert.equal(meta.exif, undefined);
  assert(original.equals(copy));
  const rotated = await inspectDocument(original, 90),
    turned = await sharp(Buffer.from(rotated.preview, "base64")).metadata();
  assert.equal(turned.width, 1800);
  assert.equal(turned.height, 2400);
});
test("Dark and blurred photos cause warnings; a legible pay record passes the quality check", async () => {
  assert.deepEqual((await inspectDocument(fixture, 0)).quality, {
    dark: false,
    blurry: false,
  });
  const dark = await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#080808" },
  })
    .jpeg()
    .toBuffer();
  assert.equal((await inspectDocument(dark, 0)).quality.dark, true);
  assert.equal(
    (await inspectDocument(await sharp(fixture).blur(20).jpeg().toBuffer(), 0))
      .quality.blurry,
    true,
  );
});
test("Every PDF page is counted; corrupt, locked, empty and overlong files are refused", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addPage();
  assert.equal(
    (await inspectDocument(Buffer.from(await pdf.save()), 0)).pages,
    2,
  );
  await assert.rejects(inspectDocument(Buffer.from("%PDF-invalid"), 0));
  const many = await PDFDocument.create();
  for (let i = 0; i < 41; i++) many.addPage();
  await assert.rejects(inspectDocument(Buffer.from(await many.save()), 0));
  await assert.rejects(inspectDocument(Buffer.alloc(0), 0));
  await assert.rejects(inspectDocument(Buffer.alloc(15 * 1024 * 1024 + 1), 0));
  await assert.rejects(
    inspectDocument(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      0,
    ),
  );
});
test("The upload contract refuses unknown fields, invalid base64 and arbitrary rotation", () => {
  assert.equal(documentUpload.safeParse({ data: "???=" }).success, false);
  assert.equal(
    documentUpload.safeParse({ data: "YWJj", rotation: 45 }).success,
    false,
  );
  assert.equal(
    documentUpload.safeParse({ data: "YWJj", ownerEmail: "other@example.test" })
      .success,
    false,
  );
});
test("Real HEIC is converted on the server while the original remains unchanged", async () => {
  const original = await readFile(
      new URL("../fixtures/documents/pay.heic", import.meta.url),
    ),
    copy = Buffer.from(original);
  const result = await inspectDocument(original, 90);
  assert.equal(result.mime, "image/heic");
  assert.equal(result.pages, 1);
  const meta = await sharp(Buffer.from(result.preview, "base64")).metadata();
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 600);
  assert(original.equals(copy));
});
