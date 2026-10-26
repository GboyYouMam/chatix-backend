import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'node:crypto';

@Injectable()
export class StorageService {
  private minioClient: Minio.Client;
  private bucketName: string;
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.getOrThrow<string>('MINIO_ENDPOINT'),
      port: Number(this.configService.getOrThrow<number>('MINIO_PORT')),
      useSSL: this.configService.get<boolean>('MINIO_USE_SSL') ?? false,
      accessKey: this.configService.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: this.configService.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
    this.bucketName =
      this.configService.getOrThrow<string>('MINIO_BUCKET_NAME');
  }

  async onModuleInit() {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucketName, 'us-east-1');

      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${this.bucketName}/*`],
          },
        ],
      };
      await this.minioClient.setBucketPolicy(
        this.bucketName,
        JSON.stringify(policy),
      );
      this.logger.log(`public bucket created: ${this.bucketName}`);
    }
  }

  private buildFileUrl(fileName: string): string {
    const publicUrl = this.configService.getOrThrow<string>('MINIO_PUBLIC_URL');
    return `${publicUrl}/${this.bucketName}/${fileName}`;
  }

  async upload(
    file: Express.Multer.File,
    detected: { ext: string; mime: string },
    folder: 'profiles' | 'attachments',
  ): Promise<string> {
    try {
      const fileName = `${folder}/${randomUUID()}.${detected.ext}`;

      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        file.buffer,
        file.size,
        {
          'Content-Type': detected.mime,
          ...(/^(image|video|audio)\//.test(detected.mime)
            ? {}
            : { 'Content-Disposition': 'attachment' }),
        },
      );

      return this.buildFileUrl(fileName);
    } catch (error) {
      this.logger.error('error while uploading to MinIO', error);
      throw new InternalServerErrorException('Cannot save this file lmao');
    }
  }

  async removeUploadedFile(fileUrl: string): Promise<void> {
    const segments = new URL(fileUrl).pathname.split('/').filter(Boolean);
    const bucketIndex = segments.indexOf(this.bucketName);
    if (bucketIndex < 0)
      throw new Error('Uploaded file URL is outside the bucket');
    await this.minioClient.removeObject(
      this.bucketName,
      segments.slice(bucketIndex + 1).join('/'),
    );
  }
}
