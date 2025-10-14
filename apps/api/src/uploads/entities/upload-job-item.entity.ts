import { UploadJobItem, UploadStatus } from '@prisma/client';

export interface UploadJobItemEntity {
  id: string;
  jobId: string;
  rowNo: number;
  payload: Record<string, unknown>;
  status: UploadStatus;
  errorMessage?: string | null;
  createdAt: Date;
}

export function toUploadJobItemEntity(record: UploadJobItem): UploadJobItemEntity {
  return {
    id: record.id,
    jobId: record.jobId,
    rowNo: record.rowNo,
    payload: (record.payloadJson as Record<string, unknown>) ?? {},
    status: record.status,
    errorMessage: record.errorMsg ?? null,
    createdAt: record.createdAt,
  };
}

