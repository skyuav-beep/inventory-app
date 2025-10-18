import { apiFetch } from '../lib/apiClient';

export interface DashboardSummaryTotals {
  totalProducts: number;
  totalIn: number;
  totalOut: number;
  totalReturn: number;
}

export interface DashboardProductItem {
  id: string;
  code: string;
  name: string;
  safetyStock: number;
  remain: number;
  status: 'normal' | 'warn' | 'low';
  totalIn: number;
  totalOut: number;
  totalReturn: number;
}

export interface DashboardSummaryResponse {
  totals: DashboardSummaryTotals;
  lowStock: DashboardProductItem[];
  stockByProduct: DashboardProductItem[];
}

export interface AlertLogItem {
  id: string;
  productName?: string;
  level: string;
  message: string;
  sentAt?: string;
  createdAt: string;
}

export interface AlertLogResponse {
  data: AlertLogItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  return apiFetch('/api/v1/dashboard/summary');
}

export async function fetchAlertLogs(params: { size?: number } = {}): Promise<AlertLogResponse> {
  const query = new URLSearchParams();
  if (params.size) {
    query.set('size', String(params.size));
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/api/v1/alerts${queryString}`);
}
