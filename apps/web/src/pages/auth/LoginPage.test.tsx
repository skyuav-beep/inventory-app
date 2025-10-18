import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { login as loginRequest, fetchCurrentUser } from '../../services/authService';

const mockLogin = vi.fn();
const mockSetUser = vi.fn();
const mockLogout = vi.fn();
const mockHasPermission = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    initializing: false,
    accessToken: null,
    user: null,
    login: mockLogin,
    logout: mockLogout,
    setUser: mockSetUser,
    hasPermission: mockHasPermission,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../services/authService', () => ({
  login: vi.fn(),
  fetchCurrentUser: vi.fn(),
}));

const loginRequestMock = vi.mocked(loginRequest);
const fetchCurrentUserMock = vi.mocked(fetchCurrentUser);

describe('LoginPage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.clear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('성공 시 토큰을 저장하고 프로필 정보를 갱신한다', async () => {
    loginRequestMock.mockResolvedValue({ accessToken: 'token-123' });
    fetchCurrentUserMock.mockResolvedValue({
      userId: 'user-1',
      email: 'admin@example.com',
      name: '관리자',
      role: 'admin',
      permissions: [],
    });

    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: '로그인' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('token-123');
    });

    expect(loginRequestMock).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'ChangeMe123!',
    });
    expect(fetchCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(mockSetUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('실패 시 에러 메시지를 노출한다', async () => {
    loginRequestMock.mockRejectedValue(new Error('Invalid credentials'));

    render(<LoginPage />);

    const submitButton = screen.getByRole('button', { name: '로그인' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText('로그인에 실패했습니다. 이메일/비밀번호를 확인하세요.'),
      ).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
    expect(fetchCurrentUserMock).not.toHaveBeenCalled();
    expect(mockSetUser).not.toHaveBeenCalled();
  });
});
