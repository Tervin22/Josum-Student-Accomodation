import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import { dirname, extname, resolve, sep } from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly localPath: string;
  private readonly s3?: S3Client;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('STORAGE_DRIVER') ?? 'local';
    this.localPath = this.config.get<string>('LOCAL_STORAGE_PATH') ?? 'uploads';
    if (this.driver === 'local') {
      this.assertPrivateLocalStoragePath();
    }
    if (this.driver === 's3') {
      const useIamRole = this.config.get<boolean>('S3_USE_IAM_ROLE') ?? false;
      const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
      const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
      this.s3 = new S3Client({
        region: this.config.get<string>('S3_REGION'),
        endpoint: this.config.get<string>('S3_ENDPOINT') || undefined,
        forcePathStyle: this.config.get<boolean>('S3_FORCE_PATH_STYLE'),
        ...(useIamRole || !accessKeyId || !secretAccessKey
          ? {}
          : {
              credentials: {
                accessKeyId,
                secretAccessKey,
              },
            }),
      });
    }
  }

  async save(buffer: Buffer, originalName: string, mimeType: string) {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const datePrefix = new Date().toISOString().slice(0, 10);
    const storageKey = `${datePrefix}/${randomUUID()}${extname(safeName)}`;

    if (this.driver === 's3') {
      await this.s3?.send(
        new PutObjectCommand({
          Bucket: this.config.get<string>('S3_BUCKET'),
          Key: storageKey,
          Body: buffer,
          ContentType: mimeType,
          Metadata: { originalName: safeName },
        }),
      );
      return storageKey;
    }

    const destination = this.resolveLocalPath(storageKey);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, buffer);
    return storageKey;
  }

  async read(storageKey: string): Promise<Readable> {
    if (this.driver === 's3') {
      const response = await this.s3?.send(
        new GetObjectCommand({
          Bucket: this.config.get<string>('S3_BUCKET'),
          Key: storageKey,
        }),
      );
      if (!response?.Body) {
        throw new NotFoundException('Stored document file was not found');
      }
      return response?.Body as Readable;
    }

    const filePath = this.resolveLocalPath(storageKey);
    await stat(filePath).catch(() => {
      throw new NotFoundException('Stored document file was not found');
    });
    return createReadStream(filePath);
  }

  async remove(storageKey: string) {
    if (this.driver === 's3') {
      await this.s3?.send(
        new DeleteObjectCommand({
          Bucket: this.config.get<string>('S3_BUCKET'),
          Key: storageKey,
        }),
      );
      return;
    }
    await unlink(this.resolveLocalPath(storageKey)).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return;
      this.logger.error(`Could not remove stored file ${storageKey}`, error.stack);
      throw error;
    });
  }

  private resolveLocalPath(storageKey: string) {
    const base = resolve(this.localPath);
    const resolved = resolve(base, storageKey);
    if (resolved !== base && !resolved.startsWith(`${base}${sep}`)) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }

  private assertPrivateLocalStoragePath() {
    const base = resolve(this.localPath);
    const webPublic = resolve('apps/web/public');
    const apiPublic = resolve('public');
    if (
      base === webPublic ||
      base.startsWith(`${webPublic}${sep}`) ||
      base === apiPublic ||
      base.startsWith(`${apiPublic}${sep}`)
    ) {
      throw new Error('LOCAL_STORAGE_PATH must not be inside a publicly served directory');
    }
  }
}
