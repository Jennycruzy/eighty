import { MAX_DOCUMENT_BYTES } from "../../shared/document-upload";
export async function fileBase64(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32768)
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  return btoa(binary);
}
export async function phonePreview(file: File, rotation: number) {
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error("size");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  } // HEIC and PDF are checked on the server, without saving them.
  try {
    if (image.width * image.height > 40_000_000) throw new Error("size");
    const scale = Math.min(1, 2400 / Math.max(image.width, image.height)),
      sideways = rotation % 180 !== 0;
    const width = Math.round(image.width * scale),
      height = Math.round(image.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? height : width;
    canvas.height = sideways ? width : height;
    const context = canvas.getContext("2d")!;
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    image.close();
  }
}

export type PhoneFileError =
  | "pdf-too-large"
  | "heic-too-large"
  | "file-too-large"
  | "photo-read";
export async function preparePhoneFile(
  file: File,
): Promise<{ file: File; smaller: boolean }> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const text = new TextDecoder("ascii").decode(header);
  const raster =
    (header[0] === 255 && header[1] === 216) ||
    (header[0] === 137 && text.slice(1, 4) === "PNG") ||
    (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP");
  if (!raster) {
    if (file.size > MAX_DOCUMENT_BYTES)
      throw new Error(
        text.startsWith("%PDF-")
          ? "pdf-too-large"
          : text.slice(4, 8) === "ftyp"
            ? "heic-too-large"
            : "file-too-large",
      );
    return { file, smaller: false };
  }
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    if (file.size <= MAX_DOCUMENT_BYTES) return { file, smaller: false };
    throw new Error("photo-read");
  }
  try {
    if (
      file.size <= MAX_DOCUMENT_BYTES &&
      image.width * image.height <= 40_000_000
    )
      return { file, smaller: false };
    let scale = Math.min(1, 4000 / Math.max(image.width, image.height));
    for (;;) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("photo-read");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("photo-read"))),
          "image/jpeg",
          0.9,
        ),
      );
      if (blob.size <= MAX_DOCUMENT_BYTES)
        return {
          file: new File([blob], "smaller-photo.jpg", { type: "image/jpeg" }),
          smaller: true,
        };
      if (canvas.width <= 1 && canvas.height <= 1)
        throw new Error("photo-read");
      scale *= 0.8;
    }
  } finally {
    image.close();
  }
}
