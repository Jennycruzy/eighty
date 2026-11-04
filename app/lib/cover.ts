import { pixelRect, type CoverBox } from "../../shared/cover-box";
import { MAX_DOCUMENT_BYTES } from "../../shared/document-upload";

const LONGEST_SIDE = 4000;
/**
 * Draws the photo with its orientation and turn applied, paints every box
 * solid black into the pixels and returns a new JPEG. The returned file has
 * no layer to remove and no copy of the covered pixels, and carries no
 * camera metadata.
 */
export async function burnInCover(
  file: Blob,
  rotation: number,
  boxes: CoverBox[],
): Promise<File> {
  const image = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    let scale = Math.min(1, LONGEST_SIDE / Math.max(image.width, image.height));
    for (;;) {
      const sideways = rotation % 180 !== 0;
      const drawWidth = Math.max(1, Math.round(image.width * scale)),
        drawHeight = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = sideways ? drawHeight : drawWidth;
      canvas.height = sideways ? drawWidth : drawHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("photo-read");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.drawImage(
        image,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight,
      );
      context.restore();
      context.fillStyle = "black";
      for (const box of boxes) {
        const rect = pixelRect(box, canvas.width, canvas.height);
        context.fillRect(rect.left, rect.top, rect.width, rect.height);
      }
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("photo-read"))),
          "image/jpeg",
          0.92,
        ),
      );
      if (blob.size <= MAX_DOCUMENT_BYTES)
        return new File([blob], "covered-photo.jpg", { type: "image/jpeg" });
      if (drawWidth <= 1 && drawHeight <= 1) throw new Error("photo-read");
      scale *= 0.8;
    }
  } finally {
    image.close();
  }
}
