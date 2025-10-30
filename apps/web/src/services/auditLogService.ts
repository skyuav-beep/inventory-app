import { apiFetch } from '../lib/apiClient';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout';
export type AuditResource =
  | 'dashboard'
  | 'products'
  | 'inbounds'
  | 'outbounds'
  | 'returns'
  | 'settings';

export interface AuditLogItem {
  id: string;
  resource: AuditResource;
  action: AuditAction;
  entityId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  payload?: unknown;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export interface FetchAuditLogsParams {
  page?: number;
  size?: number;
  resource?: AuditResource;
  action?: AuditAction;
}

export async function fetchAuditLogs(params: FetchAuditLogsParams = {}): Promise<AuditLogResponse> {
  const search = new URLSearchParams();

  if (params.page) {
    search.set('page', String(params.page));
  }

  if (params.size) {
    search.set('size', String(params.size));
  }

  if (params.resource) {
    search.set('resource', params.resource);
  }

  if (params.action) {
    search.set('action', params.action);
  }

  const query = search.toString();
  const url = query.length > 0 ? `/api/v1/audit/logs?${query}` : '/api/v1/audit/logs';

  return apiFetch<AuditLogResponse>(url);
}
