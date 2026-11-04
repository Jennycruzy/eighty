/** A box over a photo, in fractions of its width and height (0 to 1). */
export interface CoverBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const MIN_BOX = 0.02;
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** Keeps a box on the photo and at least MIN_BOX in each direction. */
export function clampBox(box: CoverBox): CoverBox {
  const width = clamp(box.width, MIN_BOX, 1),
    height = clamp(box.height, MIN_BOX, 1);
  return {
    x: clamp(box.x, 0, 1 - width),
    y: clamp(box.y, 0, 1 - height),
    width,
    height,
  };
}
/** A box from two corners of a drag, in either direction. */
export function boxFromDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
): CoverBox {
  const left = clamp(Math.min(start.x, end.x), 0, 1),
    top = clamp(Math.min(start.y, end.y), 0, 1);
  return {
    x: left,
    y: top,
    width: clamp(Math.max(start.x, end.x), 0, 1) - left,
    height: clamp(Math.max(start.y, end.y), 0, 1) - top,
  };
}
export function moveBox(box: CoverBox, dx: number, dy: number) {
  return clampBox({ ...box, x: box.x + dx, y: box.y + dy });
}
export function resizeBox(box: CoverBox, dw: number, dh: number) {
  return clampBox({ ...box, width: box.width + dw, height: box.height + dh });
}
/** Whole pixels that fully contain the box: edges round outward. */
export function pixelRect(box: CoverBox, width: number, height: number) {
  const left = Math.max(0, Math.floor(box.x * width)),
    top = Math.max(0, Math.floor(box.y * height));
  const right = Math.min(width, Math.ceil((box.x + box.width) * width)),
    bottom = Math.min(height, Math.ceil((box.y + box.height) * height));
  return { left, top, width: right - left, height: bottom - top };
}
