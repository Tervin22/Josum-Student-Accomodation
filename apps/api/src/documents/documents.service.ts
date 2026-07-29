import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { extname } from 'path';
import { AuditService } from '../audit/audit.service';
import { ApplicationsService } from '../applications/applications.service';
import { applicationDocumentsComplete } from '../applications/application-compliance';
import { DOCUMENT_REVIEW_ROLES, hasAnyRole } from '../common/roles/role-groups';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadDocumentDto } from './dto/upload-document.dto';

const allowedFileTypes: Record<string, { mimeTypes: string[]; magic: Array<number[] | string> }> = {
  '.pdf': { mimeTypes: ['application/pdf'], magic: ['%PDF'] },
  '.jpg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.jpeg': { mimeTypes: ['image/jpeg'], magic: [[0xff, 0xd8, 0xff]] },
  '.png': { mimeTypes: ['image/png'], magic: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  '.doc': { mimeTypes: ['application/msword'], magic: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]] },
  '.docx': {
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    magic: ['PK'],
  },
};

const dangerousExtensions = new Set([
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.exe',
  '.html',
  '.hta',
  '.js',
  '.jsp',
  '.msi',
  '.php',
  '.ps1',
  '.scr',
  '.sh',
  '.svg',
  '.vbs',
]);

const documentMetadataSelect = {
  id: true,
  applicationId: true,
  type: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
} as const;

type DocumentMetadata = Prisma.DocumentGetPayload<{ select: typeof documentMetadataSelect }>;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly applications: ApplicationsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async upload(user: { sub: string; roles: string[] }, dto: UploadDocumentDto, file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    this.validateFile(file);

    if (!hasAnyRole(user.roles, DOCUMENT_REVIEW_ROLES)) {
      await this.applications.assertStudentOwnsApplication(user.sub, dto.applicationId);
    }

    const storageKey = await this.storage.save(file.buffer, file.originalname, file.mimetype);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    let document: DocumentMetadata;
    try {
      document = await this.prisma.document.create({
        data: {
          applicationId: dto.applicationId,
          uploadedById: user.sub,
          type: dto.type,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          checksum,
          storageKey,
        },
        select: documentMetadataSelect,
      });
    } catch (error) {
      await this.storage.remove(storageKey).catch((cleanupError) => {
        this.logger.error(
          `Could not remove orphaned upload ${storageKey}`,
          cleanupError instanceof Error ? cleanupError.stack : String(cleanupError),
        );
      });
      throw error;
    }
    await this.audit.log({
      actorId: user.sub,
      action: 'UPLOAD_DOCUMENT',
      entity: 'Document',
      entityId: document.id,
      metadata: { applicationId: dto.applicationId, type: dto.type, size: file.size },
    });
    await this.markApplicationDocumentsSatisfied(dto.applicationId);
    return document;
  }

  async listForApplication(user: { sub: string; roles: string[] }, applicationId: string) {
    if (!hasAnyRole(user.roles, DOCUMENT_REVIEW_ROLES)) {
      await this.applications.assertStudentOwnsApplication(user.sub, applicationId);
    }
    return this.prisma.document.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      select: {
        ...documentMetadataSelect,
        uploadedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  async download(user: { sub: string; roles: string[] }, id: string) {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { application: true },
    });
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    if (!hasAnyRole(user.roles, DOCUMENT_REVIEW_ROLES) && document.application.userId !== user.sub) {
      throw new ForbiddenException('You do not have access to this document');
    }

    return {
      document,
      stream: await this.storage.read(document.storageKey),
    };
  }

  private validateFile(file: Express.Multer.File) {
    const maxBytes = this.config.get<number>('MAX_UPLOAD_BYTES') ?? 10485760;
    const extension = extname(file.originalname).toLowerCase();
    const allowed = allowedFileTypes[extension];

    if (!extension || dangerousExtensions.has(extension) || !allowed) {
      throw new BadRequestException('Unsupported or unsafe file extension');
    }
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds maximum size of ${maxBytes} bytes`);
    }
    if (!allowed.mimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }
    if (!this.matchesAllowedSignature(file.buffer, allowed.magic)) {
      throw new BadRequestException('File contents do not match the declared document type');
    }
  }

  private matchesAllowedSignature(buffer: Buffer, signatures: Array<number[] | string>) {
    return signatures.some((signature) => {
      if (typeof signature === 'string') {
        return buffer.subarray(0, signature.length).toString('ascii') === signature;
      }
      return signature.every((byte, index) => buffer[index] === byte);
    });
  }

  private async markApplicationDocumentsSatisfied(applicationId: string) {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: {
        fundingType: true,
        nationality: true,
        documentsSatisfiedAt: true,
        documents: { select: { type: true } },
      },
    });
    if (application && !application.documentsSatisfiedAt && applicationDocumentsComplete(application)) {
      await this.prisma.application.update({
        where: { id: applicationId },
        data: { documentsSatisfiedAt: new Date() },
      });
    }
  }
}
