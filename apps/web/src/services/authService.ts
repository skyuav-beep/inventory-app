import { apiFetch } from '../lib/apiClient';
import type { AuthUser } from '../hooks/useAuth';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
}

export function login(payload: LoginPayload) {
  return apiFetch<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser() {
  return apiFetch<AuthUser>('/api/v1/auth/me');
}
