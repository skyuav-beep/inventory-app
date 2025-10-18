import { apiFetch } from '../lib/apiClient';

export type Role = 'admin' | 'operator' | 'viewer';

export interface PermissionDefinition {
  resource: string;
  read: boolean;
  write: boolean;
}

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: PermissionDefinition[];
}

export interface UserListResponse {
  data: UserListItem[];
  page: {
    page: number;
    size: number;
    total: number;
  };
}

export interface PermissionTemplatesResponse {
  data: Record<Role, PermissionDefinition[]>;
}

export interface CreateUserPayload {
  email: string;
  name: string;
  role: Role;
  password: string;
  permissions?: PermissionDefinition[];
}

export interface UpdateUserPayload {
  name?: string;
  role?: Role;
  permissions?: PermissionDefinition[];
}

export async function fetchUsers(params: { page?: number; size?: number } = {}): Promise<UserListResponse> {
  const searchParams = new URLSearchParams();

  if (params.page) {
    searchParams.set('page', params.page.toString());
  }

  if (params.size) {
    searchParams.set('size', params.size.toString());
  }

  const query = searchParams.toString();
  const url = query.length > 0 ? `/api/v1/users?${query}` : '/api/v1/users';

  return apiFetch<UserListResponse>(url);
}

export async function fetchPermissionTemplates(): Promise<PermissionTemplatesResponse> {
  return apiFetch<PermissionTemplatesResponse>('/api/v1/permissions/templates');
}

export async function createUser(payload: CreateUserPayload): Promise<UserListItem> {
  return apiFetch<UserListItem>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserListItem> {
  return apiFetch<UserListItem>(`/api/v1/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
