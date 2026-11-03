import { createError } from "h3";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import {
  MAX_DOCUMENT_BYTES,
  MAX_IMAGE_PIXELS,
} from "../../shared/document-upload.ts";
import { withDecodeSlot } from "./decode-slots.ts";
import { photoQuality } from "./photo-quality.ts";

export async function inspectDocument(bytes: Buffer, rotation: number) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES)
    throw createError({
      statusCode: 413,
      statusMessage: "Use a file under 15 MB",
    });
  return withDecodeSlot(() => decodeDocument(bytes, rotation));
}

async function decodeDocument(bytes: Buffer, rotation: number) {
  if (bytes.subarray(0, 5).toString() === "%PDF-") {
    try {
      const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
      const pages = pdf.getPageCount();
      if (pages < 1 || pages > 40) throw new Error("pages");
      return { mime: "application/pdf", pages, preview: null, quality: null };
    } catch {
      throw createError({
        statusCode: 422,
        statusMessage: "Use an unlocked PDF with 1 to 40 pages",
      });
    }
  }
  try {
    const heic = bytes.subarray(4, 8).toString() === "ftyp";
    let image;
    if (heic) {
      const { default: libheif } = await import("libheif-js");
      const decoder = new libheif.HeifDecoder();
      const frames = decoder.decode(bytes);
      try {
        if (frames.length !== 1) throw new Error("Use a single photo");
        const frame = frames[0]!;
        const width = frame.get_width(),
          height = frame.get_height();
        if (width * height > MAX_IMAGE_PIXELS || width < 1 || height < 1)
          throw new Error("size");
        const raw = await new Promise<Uint8ClampedArray>((resolve, reject) => {
          frame.display(
            { width, height, data: new Uint8ClampedArray(width * height * 4) },
            (result: { data: Uint8ClampedArray } | null) =>
              result ? resolve(result.data) : reject(new Error("decode")),
          );
        });
        image = sharp(Buffer.from(raw), {
          raw: { width, height, channels: 4 },
        });
      } finally {
        for (const frame of frames) frame.free();
      }
    } else {
      image = sharp(bytes, {
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: "warning",
      });
      const metadata = await image.metadata();
      if (
        !["jpeg", "png", "webp"].includes(metadata.format || "") ||
        (metadata.pages || 1) !== 1
      )
        throw new Error("format");
    }
    const preview = await image
      .autoOrient()
      .rotate(rotation)
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "white" })
      .jpeg({ quality: 90 })
      .toBuffer();
    const { data, info } = await sharp(preview)
      .resize({ width: 640, height: 640, fit: "inside" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const quality = photoQuality(data, info.width, info.height);
    return {
      mime: heic
        ? "image/heic"
        : (await sharp(bytes).metadata()).format === "png"
          ? "image/png"
          : bytes[0] === 255
            ? "image/jpeg"
            : "image/webp",
      pages: 1,
      preview: preview.toString("base64"),
      quality,
    };
  } catch {
    throw createError({
      statusCode: 422,
      statusMessage:
        "Use a clear JPEG, PNG, WebP or HEIC photo under 40 million pixels",
    });
  }
}
