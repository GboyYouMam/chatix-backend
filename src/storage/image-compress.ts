import sharp from 'sharp';

const compressible = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function compressImage(
  buffer: Buffer,
  detected: { ext: string; mime: string },
  maxSide: number,
): Promise<{ buffer: Buffer; ext: string; mime: string }> {
  const input = { buffer, ext: detected.ext, mime: detected.mime };
  if (!compressible.has(detected.mime)) return input;
  try {
    const out = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize({
        width: maxSide,
        height: maxSide,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    if (out.length >= buffer.length) return input;
    return { buffer: out, ext: 'webp', mime: 'image/webp' };
  } catch {
    return input;
  }
}
