// A warning asks the person to check the photo. It never decides what the document says.
export function photoQuality(
  pixels: Uint8Array,
  width: number,
  height: number,
) {
  let sum = 0,
    dark = 0,
    lapSum = 0,
    lapSquare = 0,
    count = 0;
  for (const value of pixels) {
    sum += value;
    if (value < 45) dark++;
  }
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap =
        pixels[i - 1]! +
        pixels[i + 1]! +
        pixels[i - width]! +
        pixels[i + width]! -
        4 * pixels[i]!;
      lapSum += lap;
      lapSquare += lap * lap;
      count++;
    }
  const variance = count ? lapSquare / count - (lapSum / count) ** 2 : 0;
  return {
    dark: sum / pixels.length < 65 || dark / pixels.length > 0.85,
    blurry: variance < 45,
  };
}
