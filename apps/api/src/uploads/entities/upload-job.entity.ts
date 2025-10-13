import { UploadJob, UploadStatus, UploadType } from '@prisma/client';

export interface UploadJobEntity {
  id: string;
  type: UploadType;
  status: UploadStatus;
  createdById?: string | null;
  createdAt: Date;
  finishedAt?: Date | null;
  filename: string;
  originalName: string;
  lastError?: string | null;
}

export function toUploadJobEntity(record: UploadJob): UploadJobEntity {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    createdById: record.createdById,
    createdAt: record.createdAt,
    finishedAt: record.finishedAt,
    filename: record.filename,
    originalName: record.originalName,
    lastError: record.lastError ?? null,
  };
}
