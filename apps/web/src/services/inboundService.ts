import { apiFetch } from '../lib/apiClient';

export interface InboundListItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  dateIn: string;
  note?: string;
  createdAt: string;
}

export interface InboundListResponse {
  data: InboundListItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export interface FetchInboundsParams {
  page?: number;
  size?: number;
  productId?: string;
}

export interface CreateInboundPayload {
  productId: string;
  quantity: number;
  dateIn?: string;
  note?: string;
}

export interface UpdateInboundPayload {
  productId?: string;
  quantity?: number;
  dateIn?: string;
  note?: string;
}

export async function fetchInbounds(
  params: FetchInboundsParams = {},
): Promise<InboundListResponse> {
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

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<InboundListResponse>(`/api/v1/inbounds${queryString}`);
}

export async function createInbound(payload: CreateInboundPayload): Promise<InboundListItem> {
  return apiFetch<InboundListItem>('/api/v1/inbounds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateInbound(
  id: string,
  payload: UpdateInboundPayload,
): Promise<InboundListItem> {
  return apiFetch<InboundListItem>(`/api/v1/inbounds/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteInbound(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/v1/inbounds/${id}`, {
    method: 'DELETE',
  });
}
