import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductsPage } from './ProductsPage';
import { useProducts } from '../../app/hooks/useProducts';
import { useAuth } from '../../hooks/useAuth';
import { updateProduct } from '../../services/productService';

vi.mock('../../app/hooks/useProducts', () => ({
  useProducts: vi.fn(),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../services/productService', () => ({
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));

const useProductsMock = vi.mocked(useProducts);
const useAuthMock = vi.mocked(useAuth);
const updateProductMock = vi.mocked(updateProduct);

type ProductsState = ReturnType<typeof useProducts>;
type AuthContextValue = ReturnType<typeof useAuth>;

const createProductsState = (overrides: Partial<ProductsState> = {}): ProductsState =>
  ({
    items: [
      {
        id: 'p-1',
        code: 'SKU-001',
        name: '테스트 제품',
        description: '설명',
        specification: '10x20',
        unit: 'EA',
        safetyStock: 10,
        remain: 8,
        status: 'warn',
        totalIn: 120,
        totalOut: 112,
        totalReturn: 4,
        disabled: false,
      },
    ],
    pagination: { page: 1, size: 20, total: 1 },
    loading: false,
    error: null,
    filters: { search: '', status: 'all', disabledFilter: 'active' },
    setSearch: vi.fn(),
    setStatus: vi.fn(),
    setDisabledFilter: vi.fn(),
    setPage: vi.fn(),
    refresh: vi.fn(),
    summary: { total: 1, low: 0, warn: 1, normal: 0, disabled: 0 },
    ...overrides,
  }) as ProductsState;

const createAuthValue = (canWrite: boolean): AuthContextValue =>
  ({
    isAuthenticated: true,
    initializing: false,
    accessToken: 'token',
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
    setUser: vi.fn(),
    hasPermission: vi.fn().mockReturnValue(canWrite),
  }) as AuthContextValue;

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useProductsMock.mockReset();
    useAuthMock.mockReset();
    updateProductMock.mockReset();
  });

  it('제품 목록을 렌더링하고 관리 권한이 있으면 버튼을 활성화한다', async () => {
    const state = createProductsState();
    useProductsMock.mockReturnValue(state);
    useAuthMock.mockReturnValue(createAuthValue(true));

    render(<ProductsPage />);

    expect(screen.getByText('제품 목록')).toBeInTheDocument();
    expect(screen.getAllByText('테스트 제품').length).toBeGreaterThan(0);
    expect(screen.getByText('10x20')).toBeInTheDocument();
    expect(screen.getAllByText('EA').length).toBeGreaterThan(0);
    expect(screen.getAllByText('주의').length).toBeGreaterThan(0);
    const user = userEvent.setup();
    const registerButton = screen.getByRole('button', { name: '제품 등록' });
    expect(registerButton).not.toBeDisabled();
    const summaryCard = screen.getByText('현재 페이지 제품 수').closest('article');
    expect(summaryCard).not.toBeNull();
    expect(summaryCard).toHaveTextContent('1 개');
    await user.click(registerButton);
    const codeInput = await screen.findByLabelText('제품 코드');
    expect(codeInput).toHaveAttribute('readonly');

    const searchInput =
      screen.getByPlaceholderText<HTMLInputElement>('제품 코드 또는 이름으로 검색');
    expect(searchInput.value).toBe('');
  });

  it('관리 권한이 없으면 등록 버튼만 비활성화하고 템플릿은 다운로드할 수 있다', () => {
    const state = createProductsState();
    useProductsMock.mockReturnValue(state);
    useAuthMock.mockReturnValue(createAuthValue(false));

    render(<ProductsPage />);

    expect(screen.getByRole('button', { name: '제품 등록' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '템플릿 다운로드' })).toBeEnabled();
  });

  it('사용 상태 필터를 변경할 수 있다', async () => {
    const state = createProductsState();
    useProductsMock.mockReturnValue(state);
    useAuthMock.mockReturnValue(createAuthValue(true));

    const user = userEvent.setup();
    render(<ProductsPage />);

    const filterSelect = screen.getByLabelText('사용 상태 필터');
    await user.selectOptions(filterSelect, '사용 중지 제품만');

    expect(state.setDisabledFilter).toHaveBeenCalledWith('disabled');
  });

  it('로딩 중 메시지를 표시한다', () => {
    useProductsMock.mockReturnValue(
      createProductsState({
        loading: true,
        items: [],
      }),
    );
    useAuthMock.mockReturnValue(createAuthValue(true));

    render(<ProductsPage />);

    expect(screen.getByText('제품 정보를 불러오는 중입니다...')).toBeInTheDocument();
  });

  it('오류 발생 시 오류 배너를 보여준다', () => {
    useProductsMock.mockReturnValue(
      createProductsState({
        loading: false,
        error: '제품 목록을 불러오지 못했습니다.',
        items: [],
      }),
    );
    useAuthMock.mockReturnValue(createAuthValue(false));

    render(<ProductsPage />);

    expect(screen.getByText('제품 목록을 불러오지 못했습니다.')).toBeInTheDocument();
  });

  it('제품 정보를 수정할 수 있다', async () => {
    const state = createProductsState();
    useProductsMock.mockReturnValue(state);
    useAuthMock.mockReturnValue(createAuthValue(true));
    updateProductMock.mockResolvedValue({ ...state.items[0], name: '수정 제품' });

    const user = userEvent.setup();
    render(<ProductsPage />);

    const row = screen.getByRole('row', { name: /테스트 제품/ });
    const editButton = within(row).getByRole('button', { name: '수정' });
    await user.click(editButton);

    expect(screen.getByRole('heading', { name: '제품 수정' })).toBeInTheDocument();
    const nameInput = screen.getByLabelText<HTMLInputElement>('제품명');
    await user.clear(nameInput);
    await user.type(nameInput, '수정 제품');

    const modal = screen.getByRole('dialog');
    const modalSubmit = within(modal).getByRole('button', { name: '수정' });
    await user.click(modalSubmit);

    await waitFor(() => {
      expect(updateProductMock).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ name: '수정 제품' }),
      );
    });
    expect(state.refresh).toHaveBeenCalled();
  });

  it('사용 중지된 제품을 재개할 수 있다', async () => {
    const disabledProduct = {
      id: 'p-2',
      code: 'SKU-002',
      name: '중지 제품',
      description: '설명',
      specification: '5x5',
      unit: 'EA',
      safetyStock: 5,
      remain: 0,
      status: 'low' as const,
      totalIn: 10,
      totalOut: 10,
      totalReturn: 0,
      disabled: true,
    };

    const state = createProductsState({
      items: [disabledProduct],
      summary: { total: 1, low: 1, warn: 0, normal: 0, disabled: 1 },
    });

    useProductsMock.mockReturnValue(state);
    useAuthMock.mockReturnValue(createAuthValue(true));
    updateProductMock.mockResolvedValue({ ...disabledProduct, disabled: false });

    const user = userEvent.setup();
    render(<ProductsPage />);

    const row = screen.getByRole('row', { name: /중지 제품/ });
    const resumeButton = within(row).getByRole('button', { name: '사용 재개' });
    await user.click(resumeButton);

    await waitFor(() => {
      expect(updateProductMock).toHaveBeenCalledWith(
        'p-2',
        expect.objectContaining({ disabled: false }),
      );
    });
    expect(state.refresh).toHaveBeenCalled();
  });
});
