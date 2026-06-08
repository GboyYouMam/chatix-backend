import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService {
    private minioClient: Minio.Client;
    private bucketName: string;
    private readonly logger = new Logger(StorageService.name);

    constructor(private configService: ConfigService) {
        this.minioClient = new Minio.Client({
            endPoint: this.configService.get<string>('MINIO_ENDPOINT') || '127.0.0.1',
            port: Number(this.configService.get<number>('MINIO_PORT')) || 9000,
            useSSL: false,
            accessKey: this.configService.get<string>('MINIO_ACCESS_KEY') as string,
            secretKey: this.configService.get<string>('MINIO_SECRET_KEY') as string,
        });
        this.bucketName = this.configService.get<string>('MINIO_BUCKET_NAME') || 'avatars';
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
            await this.minioClient.setBucketPolicy(this.bucketName, JSON.stringify(policy));
            this.logger.log(`public bucket created: ${this.bucketName}`);
        }
    }

    private buildFileUrl(fileName: string): string {
        const publicUrl = this.configService.getOrThrow<string>('MINIO_PUBLIC_URL');
        return `${publicUrl}/${this.bucketName}/${fileName}`;
    }

    async uploadFile(file: Express.Multer.File, userId: string): Promise<{
        objectName: string;
        bucket: string;
        url: string;
        etag: string;
        versionId?: string
    }> {
        try {
            const extension = file.originalname.split('.').pop();
            const fileName = `${userId}-${Date.now()}.${extension}`;

            const result = await this.minioClient.putObject(
                this.bucketName,
                fileName,
                file.buffer,
                file.size,
                { 'Content-Type': file.mimetype }
            );

            const url = this.buildFileUrl(fileName);

            return {
                objectName: fileName,
                bucket: this.bucketName,
                url: url,
                etag: result.etag,
                versionId: result.versionId as string || undefined,
            };
        } catch (error) {
            this.logger.error('error while uploading to MinIO', error);
            throw new InternalServerErrorException('Cannot save this file lmao');
        }
    }
}