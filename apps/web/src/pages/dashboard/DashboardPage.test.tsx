import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { fetchDashboardSummary, fetchAlertLogs } from '../../services/dashboardService';

vi.mock('../../services/dashboardService', () => ({
  fetchDashboardSummary: vi.fn(),
  fetchAlertLogs: vi.fn(),
}));

const mockSummary = {
  totals: {
    totalProducts: 12,
    totalIn: 480,
    totalOut: 320,
    totalReturn: 24,
  },
  lowStock: [
    {
      id: 'p-1',
      code: 'SKU-001',
      name: '테스트 제품',
      safetyStock: 20,
      remain: 5,
      status: 'low',
      totalIn: 120,
      totalOut: 100,
      totalReturn: 5,
    },
  ],
  stockByProduct: [
    {
      id: 'p-1',
      code: 'SKU-001',
      name: '테스트 제품',
      safetyStock: 20,
      remain: 50,
      status: 'normal',
      totalIn: 120,
      totalOut: 70,
      totalReturn: 5,
    },
    {
      id: 'p-2',
      code: 'SKU-002',
      name: '경고 제품',
      safetyStock: 30,
      remain: 20,
      status: 'warn',
      totalIn: 90,
      totalOut: 70,
      totalReturn: 0,
    },
  ],
};

const mockAlerts = {
  data: [
    {
      id: 'alert-1',
      level: 'low',
      message: '테스트 알림',
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
    },
  ],
  page: { page: 1, size: 5, total: 1 },
};

describe('DashboardPage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('성공적으로 데이터를 렌더링한다', async () => {
    vi.mocked(fetchDashboardSummary).mockResolvedValue(mockSummary);
    vi.mocked(fetchAlertLogs).mockResolvedValue(mockAlerts);

    render(<DashboardPage />);

    expect(screen.getByText('대시보드 데이터를 불러오는 중입니다...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('전체 제품')).toBeInTheDocument();
    });

    expect(screen.getByText('총 입고 수량')).toBeInTheDocument();
    expect(screen.getAllByText('테스트 제품').length).toBeGreaterThan(0);
    expect(screen.getByText('테스트 알림')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '제품별 재고 현황' })).toBeInTheDocument();
    expect(screen.getByText('경고 제품')).toBeInTheDocument();
  });

  it('실패 시 에러 메시지를 표시한다', async () => {
    vi.mocked(fetchDashboardSummary).mockRejectedValue(new Error('네트워크 오류'));
    vi.mocked(fetchAlertLogs).mockResolvedValue(mockAlerts);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          '대시보드 데이터를 불러올 수 없습니다. 로그인 여부를 확인하거나 잠시 후 다시 시도하세요.',
        ),
      ).toBeInTheDocument();
    });
  });
});
