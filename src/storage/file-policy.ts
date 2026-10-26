import { BadRequestException, Logger } from '@nestjs/common';

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

type DetectedFile = { ext: string; mime: string };

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

// Only the formats from the allowlists above. A fixed-offset check cannot loop
// on malformed input, unlike a full container parser.
function sniff(buffer: Buffer): DetectedFile | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { ext: 'png', mime: 'image/png' };
  if (startsWith(buffer, [0xff, 0xd8, 0xff]))
    return { ext: 'jpg', mime: 'image/jpeg' };
  if (
    startsWith(buffer, ascii('GIF87a')) ||
    startsWith(buffer, ascii('GIF89a'))
  )
    return { ext: 'gif', mime: 'image/gif' };
  if (startsWith(buffer, ascii('RIFF')) && startsWith(buffer, ascii('WEBP'), 8))
    return { ext: 'webp', mime: 'image/webp' };
  if (startsWith(buffer, ascii('%PDF-')))
    return { ext: 'pdf', mime: 'application/pdf' };
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]))
    return { ext: 'zip', mime: 'application/zip' };
  if (startsWith(buffer, ascii('ftyp'), 4))
    return { ext: 'mp4', mime: 'video/mp4' };
  if (
    startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]) &&
    buffer.subarray(0, 64).includes('webm')
  )
    return { ext: 'webm', mime: 'video/webm' };
  if (
    startsWith(buffer, ascii('ID3')) ||
    (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  )
    return { ext: 'mp3', mime: 'audio/mpeg' };
  return null;
}

export function detectFile(
  buffer: Buffer,
  declaredMime: string,
): Promise<DetectedFile | null> {
  return Promise.resolve(detectSync(buffer, declaredMime));
}

function detectSync(buffer: Buffer, declaredMime: string): DetectedFile | null {
  const detected = sniff(buffer);
  if (detected) return detected;
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
