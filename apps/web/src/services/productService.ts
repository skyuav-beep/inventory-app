import { apiFetch } from '../lib/apiClient';

export type ProductStatus = 'normal' | 'warn' | 'low';

export interface ProductListItem {
  id: string;
  code: string;
  name: string;
  safetyStock: number;
  remain: number;
  status: ProductStatus;
  totalIn: number;
  totalOut: number;
  totalReturn: number;
}

export interface ProductListResponse {
  data: ProductListItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export interface FetchProductsParams {
  page?: number;
  size?: number;
  search?: string;
  status?: ProductStatus;
}

export async function fetchProducts(params: FetchProductsParams = {}): Promise<ProductListResponse> {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.size) {
    query.set('size', String(params.size));
  }

  if (params.search && params.search.trim().length > 0) {
    query.set('q', params.search.trim());
  }

  if (params.status) {
    query.set('status', params.status);
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<ProductListResponse>(`/api/v1/products${queryString}`);
}

