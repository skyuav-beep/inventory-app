import { apiFetch } from '../lib/apiClient';

export type UploadKind = 'inbound' | 'outbound';
export type UploadStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface UploadJobCounts {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  queued: number;
}

export interface UploadJob {
  id: string;
  type: UploadKind;
  status: UploadStatus;
  createdById?: string | null;
  createdAt: string;
  finishedAt?: string | null;
  filename: string;
  originalName: string;
  lastError?: string | null;
  itemCounts?: UploadJobCounts;
}

export interface UploadJobItem {
  id: string;
  jobId: string;
  rowNo: number;
  payload: Record<string, unknown>;
  status: UploadStatus;
  errorMessage?: string | null;
  createdAt: string;
}

interface UploadResponse {
  job: UploadJob;
  message: string;
}

interface UploadJobsResponse {
  data: UploadJob[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

interface UploadJobItemsResponse {
  job: UploadJob;
  data: UploadJobItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export async function uploadStockFile(type: UploadKind, file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<UploadResponse>(`/api/v1/uploads/${type === 'inbound' ? 'inbounds' : 'outbounds'}`, {
    method: 'POST',
    body: formData,
  });
}

export async function fetchUploadJobs(params: { page?: number; size?: number; status?: UploadStatus } = {}): Promise<UploadJobsResponse> {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.size) {
    query.set('size', String(params.size));
  }

  if (params.status) {
    query.set('status', params.status);
  }

  const queryString = query.toString();
  return apiFetch<UploadJobsResponse>(`/api/v1/uploads/jobs${queryString ? `?${queryString}` : ''}`);
}

export async function fetchUploadJobItems(
  jobId: string,
  params: { page?: number; size?: number } = {},
): Promise<UploadJobItemsResponse> {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.size) {
    query.set('size', String(params.size));
  }

  const queryString = query.toString();
  return apiFetch<UploadJobItemsResponse>(
    `/api/v1/uploads/jobs/${jobId}/items${queryString ? `?${queryString}` : ''}`,
  );
}
