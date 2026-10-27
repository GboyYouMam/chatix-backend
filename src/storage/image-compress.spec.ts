import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { compressImage } from './image-compress';

describe('compressImage', () => {
  it('re-encodes a large noisy PNG to bounded webp that is smaller', async () => {
    const width = 3000;
    const height = 2000;
    const input = await sharp(randomBytes(width * height * 3), {
      raw: { width, height, channels: 3 },
    })
      .png()
      .toBuffer();

    const out = await compressImage(
      input,
      { ext: 'png', mime: 'image/png' },
      1600,
    );

    expect(out).toMatchObject({ ext: 'webp', mime: 'image/webp' });
    expect(out.buffer.length).toBeLessThan(input.length);
    const meta = await sharp(out.buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(1600);
    expect(meta.height).toBeLessThanOrEqual(1600);
  });

  it('leaves gifs untouched since they may be animated', async () => {
    const gif = Buffer.from('GIF89a' + randomBytes(256).toString('hex'));

    const out = await compressImage(
      gif,
      { ext: 'gif', mime: 'image/gif' },
      1600,
    );

    expect(out.mime).toBe('image/gif');
    expect(out.buffer.equals(gif)).toBe(true);
  });

  it('returns a corrupt jpeg unchanged instead of throwing', async () => {
    const broken = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      randomBytes(512),
    ]);

    const out = await compressImage(
      broken,
      { ext: 'jpg', mime: 'image/jpeg' },
      1600,
    );

    expect(out).toEqual({ buffer: broken, ext: 'jpg', mime: 'image/jpeg' });
  });
});
