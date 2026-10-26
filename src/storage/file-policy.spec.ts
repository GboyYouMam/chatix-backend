import { BadRequestException } from '@nestjs/common';
import {
  assertAllowed,
  detectFile,
  MESSAGE_ATTACHMENT_POLICY,
  PROFILE_IMAGE_POLICY,
} from './file-policy';

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);
const file = (buffer: Buffer, mimetype: string, originalname = 'upload.bin') =>
  ({
    buffer,
    mimetype,
    originalname,
    size: buffer.length,
  }) as Express.Multer.File;

describe('file policy', () => {
  it('detects file contents instead of trusting the extension', async () => {
    expect(
      await assertAllowed(
        file(png, 'text/html', 'x.html'),
        PROFILE_IMAGE_POLICY,
      ),
    ).toEqual({
      ext: 'png',
      mime: 'image/png',
    });
  });

  it.each([
    [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">'), 'image/png'],
    [Buffer.from('<html>'), 'image/png'],
  ])('rejects active text disguised as an image', async (buffer, mimetype) => {
    await expect(
      assertAllowed(file(buffer, mimetype), MESSAGE_ATTACHMENT_POLICY),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows valid plain text only for message attachments', async () => {
    const text = file(Buffer.from('<html>'), 'text/plain');
    await expect(
      assertAllowed(text, MESSAGE_ATTACHMENT_POLICY),
    ).resolves.toEqual({
      ext: 'txt',
      mime: 'text/plain',
    });
    await expect(assertAllowed(text, PROFILE_IMAGE_POLICY)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects unsupported signatures, oversized files, and invalid UTF-8', async () => {
    expect(await detectFile(Buffer.from([0, 0, 0]), 'text/plain')).toBeNull();
    expect(
      await detectFile(Buffer.from([0xc3, 0x28]), 'text/plain'),
    ).toBeNull();
    await expect(
      assertAllowed(
        file(Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png'),
        PROFILE_IMAGE_POLICY,
      ),
    ).rejects.toThrow('file too big, chud');
    await expect(
      assertAllowed(
        file(Buffer.from([0x25, 0x50, 0x44, 0x46]), 'application/pdf'),
        PROFILE_IMAGE_POLICY,
      ),
    ).rejects.toThrow('file type not allowed. nice try.');
  });

  it('rejects text containing a null byte', async () => {
    expect(
      await detectFile(Buffer.from([0x61, 0x00, 0x62]), 'text/plain'),
    ).toBeNull();
  });
});
