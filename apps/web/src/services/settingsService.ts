import { apiFetch } from '../lib/apiClient';

export type AlertPolicyReason = 'ok' | 'cooldown' | 'quiet_hours';

export interface TelegramTarget {
  id?: string;
  chatId: string;
  label?: string;
  enabled: boolean;
}

export interface TelegramSettingsResponse {
  enabled: boolean;
  botToken?: string;
  cooldownMinutes: number;
  quietHours: string;
  targets: TelegramTarget[];
  updatedAt: string;
}

export interface UpdateTelegramSettingsPayload {
  enabled: boolean;
  botToken?: string;
  cooldownMinutes: number;
  quietHours: string;
  targets?: Array<{
    chatId: string;
    label?: string;
    enabled?: boolean;
  }>;
}

export interface AlertEntity {
  id: string;
  level: string;
  channel: string;
  message: string;
  sentAt?: string;
  createdAt: string;
}

export interface AlertTestResponse {
  success: boolean;
  decision: {
    reason: AlertPolicyReason;
    canSend: boolean;
    nextAttemptAt?: string;
  };
  alert?: AlertEntity;
}

export async function fetchTelegramSettings(): Promise<TelegramSettingsResponse> {
  return apiFetch<TelegramSettingsResponse>('/api/v1/settings/notifications/telegram');
}

export async function updateTelegramSettings(
  payload: UpdateTelegramSettingsPayload,
): Promise<TelegramSettingsResponse> {
  return apiFetch<TelegramSettingsResponse>('/api/v1/settings/notifications/telegram', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function sendTestAlert(): Promise<AlertTestResponse> {
  return apiFetch<AlertTestResponse>('/api/v1/alerts/test', {
    method: 'POST',
  });
}

export async function sendCustomAlert(message: string): Promise<AlertTestResponse> {
  return apiFetch<AlertTestResponse>('/api/v1/alerts/custom', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
