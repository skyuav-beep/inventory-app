import { apiFetch } from '../lib/apiClient';

export interface OutboundListItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  quantity: number;
  dateOut: string;
  note?: string;
  createdAt: string;
}

export interface OutboundListResponse {
  data: OutboundListItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export interface FetchOutboundsParams {
  page?: number;
  size?: number;
  productId?: string;
}

export interface CreateOutboundPayload {
  productId: string;
  quantity: number;
  dateOut?: string;
  note?: string;
}

export async function fetchOutbounds(params: FetchOutboundsParams = {}): Promise<OutboundListResponse> {
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
  return apiFetch<OutboundListResponse>(`/api/v1/outbounds${queryString}`);
}

export async function createOutbound(payload: CreateOutboundPayload): Promise<OutboundListItem> {
  return apiFetch<OutboundListItem>('/api/v1/outbounds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
