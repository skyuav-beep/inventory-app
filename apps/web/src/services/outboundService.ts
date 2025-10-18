import { apiFetch } from '../lib/apiClient';

export type OutboundStatus = 'shipped' | 'in_transit' | 'delivered' | 'returned';

export interface OutboundListItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  productUnit: string;
  quantity: number;
  dateOut: string;
  status: OutboundStatus;
  orderDate?: string;
  ordererId?: string;
  ordererName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  customsNumber?: string;
  invoiceNumber?: string;
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
  status?: OutboundStatus;
}

export interface CreateOutboundPayload {
  productId: string;
  quantity: number;
  dateOut?: string;
  note?: string;
  orderDate?: string;
  ordererId?: string;
  ordererName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  customsNumber?: string;
  invoiceNumber?: string;
  status?: OutboundStatus;
}

export async function fetchOutbounds(
  params: FetchOutboundsParams = {},
): Promise<OutboundListResponse> {
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
  return apiFetch<OutboundListResponse>(`/api/v1/outbounds${queryString}`);
}

export async function createOutbound(payload: CreateOutboundPayload): Promise<OutboundListItem> {
  return apiFetch<OutboundListItem>('/api/v1/outbounds', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface UpdateOutboundPayload {
  productId?: string;
  quantity?: number;
  dateOut?: string;
  note?: string;
  orderDate?: string;
  ordererId?: string;
  ordererName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  customsNumber?: string;
  invoiceNumber?: string;
  status?: OutboundStatus;
}

export async function updateOutbound(
  id: string,
  payload: UpdateOutboundPayload,
): Promise<OutboundListItem> {
  return apiFetch<OutboundListItem>(`/api/v1/outbounds/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteOutbound(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/v1/outbounds/${id}`, {
    method: 'DELETE',
  });
}
