import { apiFetch } from '../lib/apiClient';

export type UploadKind = 'inbound' | 'outbound';

interface UploadResponse {
  job: {
    id: string;
    type: UploadKind;
    status: string;
    createdAt: string;
    filename: string;
    originalName: string;
  };
  message: string;
}

export async function uploadStockFile(type: UploadKind, file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<UploadResponse>(`/api/v1/uploads/${type === 'inbound' ? 'inbounds' : 'outbounds'}`, {
    method: 'POST',
    body: formData,
  });
}
