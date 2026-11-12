// Match using local luminance and contrast, without RGB colour channels.
export function neutralFacePixels(data, width, height, channels, box) {
  const luminance = i => .299 * data[i] + .587 * data[i + 1] + .114 * data[i + 2];
  const x0 = Math.max(0, Math.floor(box.x + box.width * .15));
  const x1 = Math.min(width, Math.ceil(box.x + box.width * .85));
  const y0 = Math.max(0, Math.floor(box.y + box.height * .15));
  const y1 = Math.min(height, Math.ceil(box.y + box.height * .85));
  let sum = 0, square = 0, count = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const v = luminance((y * width + x) * channels);
    sum += v; square += v * v; count++;
  }
  const mean = count ? sum / count : 128;
  const deviation = count ? Math.sqrt(Math.max(0, square / count - mean * mean)) : 45;
  // Cap gain so low-contrast input does not turn sensor noise into features.
  const gain = Math.max(.65, Math.min(2.4, 45 / Math.max(1, deviation)));
  const result = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; j < result.length; i += channels, j += 3) {
    const v = Math.max(0, Math.min(255, Math.round(128 + (luminance(i) - mean) * gain)));
    result[j] = result[j + 1] = result[j + 2] = v;
  }
  return result;
}
