import { apiFetch } from '../lib/apiClient';

export type ProductStatus = 'normal' | 'warn' | 'low';

export interface ProductListItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  specification?: string;
  unit: string;
  safetyStock: number;
  remain: number;
  status: ProductStatus;
  totalIn: number;
  totalOut: number;
  totalReturn: number;
  disabled: boolean;
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
  includeDisabled?: boolean;
  disabled?: boolean;
}

export interface CreateProductPayload {
  code: string;
  name: string;
  description?: string;
  specification?: string;
  unit?: string;
  safetyStock?: number;
  disabled?: boolean;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  specification?: string;
  unit?: string;
  safetyStock?: number;
  disabled?: boolean;
}

export async function fetchProducts(
  params: FetchProductsParams = {},
): Promise<ProductListResponse> {
  const query = new URLSearchParams();

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.size) {
    query.set('size', String(params.size));
  }

  if (params.search && params.search.trim().length > 0) {
    query.set('search', params.search.trim());
  }

  if (params.status) {
    query.set('status', params.status);
  }

  if (typeof params.disabled === 'boolean') {
    query.set('disabled', String(params.disabled));
  } else if (params.includeDisabled) {
    query.set('includeDisabled', 'true');
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<ProductListResponse>(`/api/v1/products${queryString}`);
}

export async function createProduct(payload: CreateProductPayload): Promise<ProductListItem> {
  return apiFetch<ProductListItem>('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProduct(
  id: string,
  payload: UpdateProductPayload,
): Promise<ProductListItem> {
  return apiFetch<ProductListItem>(`/api/v1/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
