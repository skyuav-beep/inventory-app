import { apiFetch } from '../lib/apiClient';

export type ReturnStatus = 'pending' | 'completed';

export interface ReturnListItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  reason: string;
  status: ReturnStatus;
  dateReturn: string;
  dateOut?: string | null;
  ordererId?: string | null;
  ordererName?: string | null;
  outboundId?: string | null;
  createdAt: string;
}

export interface ReturnListResponse {
  data: ReturnListItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export interface FetchReturnsParams {
  page?: number;
  size?: number;
  productId?: string;
  status?: ReturnStatus;
}

export interface CreateReturnPayload {
  productId: string;
  quantity: number;
  reason: string;
  dateReturn?: string;
  status?: ReturnStatus;
  outboundId?: string;
}

export interface UpdateReturnPayload {
  productId?: string;
  quantity?: number;
  reason?: string;
  dateReturn?: string;
  status?: ReturnStatus;
  outboundId?: string;
}

export async function fetchReturns(params: FetchReturnsParams = {}): Promise<ReturnListResponse> {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.size) {
    query.set('size', String(params.size));
  }

  if (params.productId) {
    query.set('productId', params.productId);
  }

  if (params.status) {
    query.set('status', params.status);
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<ReturnListResponse>(`/api/v1/returns${queryString}`);
}

export async function createReturn(payload: CreateReturnPayload): Promise<ReturnListItem> {
  return apiFetch<ReturnListItem>('/api/v1/returns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateReturn(
  id: string,
  payload: UpdateReturnPayload,
): Promise<ReturnListItem> {
  return apiFetch<ReturnListItem>(`/api/v1/returns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteReturn(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/v1/returns/${id}`, {
    method: 'DELETE',
  });
}
