import { BadRequestException, Logger } from '@nestjs/common';
import { fromBuffer } from 'file-type';

export interface FilePolicy {
  allowed: ReadonlyArray<{ ext: string; mime: string }>;
  maxBytes: number;
  maxFiles: number;
}

const images = [
  { ext: 'png', mime: 'image/png' },
  { ext: 'jpg', mime: 'image/jpeg' },
  { ext: 'webp', mime: 'image/webp' },
  { ext: 'gif', mime: 'image/gif' },
] as const;

export const PROFILE_IMAGE_POLICY: FilePolicy = {
  allowed: images,
  maxBytes: 5 * 1024 * 1024,
  maxFiles: 1,
};

export const MESSAGE_ATTACHMENT_POLICY: FilePolicy = {
  allowed: [
    ...images,
    { ext: 'pdf', mime: 'application/pdf' },
    { ext: 'txt', mime: 'text/plain' },
    { ext: 'zip', mime: 'application/zip' },
    { ext: 'mp4', mime: 'video/mp4' },
    { ext: 'webm', mime: 'video/webm' },
    { ext: 'mp3', mime: 'audio/mpeg' },
  ],
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 5,
};

export async function detectFile(
  buffer: Buffer,
  declaredMime: string,
): Promise<{ ext: string; mime: string } | null> {
  const detected = await fromBuffer(buffer);
  if (detected) return { ext: detected.ext, mime: detected.mime };
  if (declaredMime !== 'text/plain' || buffer.includes(0)) return null;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return { ext: 'txt', mime: 'text/plain' };
  } catch {
    return null;
  }
}

const logger = new Logger('FilePolicy');

export async function assertAllowed(
  file: Express.Multer.File,
  policy: FilePolicy,
): Promise<{ ext: string; mime: string }> {
  if (file.size > policy.maxBytes) {
    logger.warn({
      event: 'upload.rejected',
      reason: 'too_large',
      size: file.size,
      declaredMime: file.mimetype,
    });
    throw new BadRequestException('file too big, chud');
  }
  const detected = await detectFile(file.buffer, file.mimetype);
  if (
    !detected ||
    !policy.allowed.some(
      (allowed) =>
        allowed.ext === detected.ext && allowed.mime === detected.mime,
    )
  ) {
    logger.warn({
      event: 'upload.rejected',
      reason: 'type_not_allowed',
      size: file.size,
      declaredMime: file.mimetype,
    });
    throw new BadRequestException('file type not allowed. nice try.');
  }
  return detected;
}
