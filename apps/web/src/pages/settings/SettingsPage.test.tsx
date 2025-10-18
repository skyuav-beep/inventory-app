import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { useAuth } from '../../hooks/useAuth';
import { useUsers } from '../../app/hooks/useUsers';
import {
  fetchTelegramSettings,
  updateTelegramSettings,
  sendCustomAlert,
  sendTestAlert,
} from '../../services/settingsService';
import { fetchPermissionTemplates, createUser } from '../../services/userService';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../app/hooks/useUsers', () => ({
  useUsers: vi.fn(),
}));

vi.mock('../../services/settingsService', () => ({
  fetchTelegramSettings: vi.fn(),
  updateTelegramSettings: vi.fn(),
  sendCustomAlert: vi.fn(),
  sendTestAlert: vi.fn(),
}));

vi.mock('../../services/userService', () => ({
  fetchPermissionTemplates: vi.fn(),
  createUser: vi.fn(),
}));

const useAuthMock = vi.mocked(useAuth);
const useUsersMock = vi.mocked(useUsers);
const fetchTelegramSettingsMock = vi.mocked(fetchTelegramSettings);
const fetchPermissionTemplatesMock = vi.mocked(fetchPermissionTemplates);
const updateTelegramSettingsMock = vi.mocked(updateTelegramSettings);
const sendCustomAlertMock = vi.mocked(sendCustomAlert);
const sendTestAlertMock = vi.mocked(sendTestAlert);
const createUserMock = vi.mocked(createUser);

type UsersState = ReturnType<typeof useUsers>;
type AuthContextValue = ReturnType<typeof useAuth>;

const createUsersState = (overrides: Partial<UsersState> = {}): UsersState =>
  ({
    items: [
      {
        id: 'user-1',
        email: 'ops@example.com',
        name: 'Operations',
        role: 'operator',
        permissions: [
          { resource: 'dashboard', read: true, write: false },
          { resource: 'products', read: true, write: true },
          { resource: 'settings', read: true, write: false },
        ],
      },
    ],
    pagination: { page: 1, size: 10, total: 1 },
    loading: false,
    error: null,
    setPage: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  }) as UsersState;

const createAuthValue = (write = true): AuthContextValue =>
  ({
    isAuthenticated: true,
    initializing: false,
    accessToken: 'token',
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    hasPermission: vi
      .fn()
      .mockImplementation((_resource: string, options?: { write?: boolean }) =>
        options?.write ? write : true,
      ),
  }) as AuthContextValue;

describe('SettingsPage - 사용자 권한 관리', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchTelegramSettingsMock.mockResolvedValue({
      enabled: true,
      botToken: 'mock-token',
      cooldownMinutes: 30,
      quietHours: '22-07',
      targets: [],
      updatedAt: new Date().toISOString(),
    });
    updateTelegramSettingsMock.mockResolvedValue({
      enabled: true,
      botToken: 'mock-token',
      cooldownMinutes: 30,
      quietHours: '22-07',
      targets: [],
      updatedAt: new Date().toISOString(),
    });
    sendTestAlertMock.mockResolvedValue({
      success: true,
      decision: { reason: 'ok', canSend: true },
    });
    sendCustomAlertMock.mockResolvedValue({
      success: true,
      decision: { reason: 'ok', canSend: true },
    });
  });

  afterEach(() => {
    useUsersMock.mockReset();
    useAuthMock.mockReset();
    fetchPermissionTemplatesMock.mockReset();
    createUserMock.mockReset();
    updateTelegramSettingsMock.mockReset();
    sendTestAlertMock.mockReset();
    sendCustomAlertMock.mockReset();
  });

  it('사용자 목록과 권한 정보를 렌더링한다', async () => {
    useUsersMock.mockReturnValue(createUsersState());
    useAuthMock.mockReturnValue(createAuthValue(true));

    render(<SettingsPage />);

    await waitFor(() => expect(fetchTelegramSettingsMock).toHaveBeenCalled());

    expect(screen.getByText('사용자 & 권한')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('ops@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('운영자').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: '사용자 초대' })).toBeEnabled();
  });

  it('사용자 초대 모달에서 권한 템플릿을 불러오고 사용자 생성 요청을 보낸다', async () => {
    const refreshMock = vi.fn();
    useUsersMock.mockReturnValue(
      createUsersState({
        refresh: refreshMock,
      }),
    );
    useAuthMock.mockReturnValue(createAuthValue(true));
    fetchPermissionTemplatesMock.mockResolvedValue({
      data: {
        admin: [
          { resource: 'dashboard', read: true, write: true },
          { resource: 'products', read: true, write: true },
          { resource: 'settings', read: true, write: true },
        ],
        operator: [
          { resource: 'dashboard', read: true, write: false },
          { resource: 'products', read: true, write: true },
          { resource: 'settings', read: true, write: false },
        ],
        viewer: [
          { resource: 'dashboard', read: true, write: false },
          { resource: 'products', read: true, write: false },
          { resource: 'settings', read: false, write: false },
        ],
      },
    });
    createUserMock.mockResolvedValue({
      id: 'user-2',
      email: 'new@example.com',
      name: 'New User',
      role: 'operator',
      permissions: [],
    });

    const user = userEvent.setup();
    render(<SettingsPage />);
    await waitFor(() => expect(fetchTelegramSettingsMock).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '사용자 초대' }));

    await waitFor(() => expect(fetchPermissionTemplatesMock).toHaveBeenCalled());

    const emailInput = await screen.findByLabelText('이메일');
    await user.type(emailInput, 'new@example.com');
    await user.type(screen.getByLabelText('이름'), 'New User');
    await user.type(screen.getByLabelText('임시 비밀번호'), 'Pass1234');

    // 토글 쓰기 권한
    const modal = screen.getByRole('dialog');
    const productsRow = within(modal).getByText('제품').closest('tr');
    expect(productsRow).not.toBeNull();
    const writeCheckbox = within(productsRow as HTMLElement).getByLabelText('쓰기 허용');
    expect(writeCheckbox).toBeChecked();
    await user.click(writeCheckbox);
    expect(writeCheckbox).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: '역할 템플릿으로 초기화' }));
    expect(writeCheckbox).toBeChecked();

    await user.click(screen.getByRole('button', { name: '사용자 생성' }));

    await waitFor(() =>
      expect(createUserMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
          role: 'operator',
        }),
      ),
    );

    expect(refreshMock).toHaveBeenCalled();
  });
});
