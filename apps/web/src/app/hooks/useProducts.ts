import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FetchProductsParams,
  ProductListItem,
  ProductListResponse,
  ProductStatus,
  fetchProducts,
} from '../../services/productService';

export type ProductDisabledFilter = 'active' | 'with-disabled' | 'disabled';

interface UseProductsFilters {
  search: string;
  status?: ProductStatus | 'all';
  disabledFilter: ProductDisabledFilter;
}

interface UseProductsState {
  items: ProductListItem[];
  pagination: ProductListResponse['page'];
  loading: boolean;
  error: string | null;
  filters: UseProductsFilters;
  setSearch: (value: string) => void;
  setStatus: (value: ProductStatus | 'all') => void;
  setDisabledFilter: (value: ProductDisabledFilter) => void;
  setPage: (page: number) => void;
  refresh: () => void;
  summary: {
    total: number;
    low: number;
    warn: number;
    normal: number;
    disabled: number;
  };
}

const DEFAULT_PAGE = { page: 1, size: 20, total: 0 };

export function useProducts(
  initialFilters: Partial<UseProductsFilters> = {
    search: '',
    status: 'all',
    disabledFilter: 'active',
  },
): UseProductsState {
  const mergedFilters: UseProductsFilters = {
    search: initialFilters.search ?? '',
    status: initialFilters.status ?? 'all',
    disabledFilter: initialFilters.disabledFilter ?? 'active',
  };

  const [items, setItems] = useState<ProductListItem[]>([]);
  const [pagination, setPagination] = useState<ProductListResponse['page']>(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UseProductsFilters>(mergedFilters);
  const [page, setPageState] = useState<number>(DEFAULT_PAGE.page);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params: FetchProductsParams = {
      page,
      size: DEFAULT_PAGE.size,
      search: filters.search,
      status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    };

    if (filters.disabledFilter === 'disabled') {
      params.disabled = true;
    } else if (filters.disabledFilter === 'with-disabled') {
      params.includeDisabled = true;
    }

    try {
      const response = await fetchProducts(params);
      setItems(response.data);
      setPagination(response.page);
    } catch (err) {
      console.error(err);
      setError('제품 목록을 불러오지 못했습니다.');
      setItems([]);
      setPagination(DEFAULT_PAGE);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.status, filters.disabledFilter, page]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts, refreshIndex]);

  const setSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setPageState(1);
  }, []);

  const setStatus = useCallback((value: ProductStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status: value }));
    setPageState(1);
  }, []);

  const setDisabledFilter = useCallback((value: ProductDisabledFilter) => {
    setFilters((prev) => ({ ...prev, disabledFilter: value }));
    setPageState(1);
  }, []);

  const handleSetPage = useCallback((nextPage: number) => {
    setPageState(nextPage);
  }, []);

  const refresh = useCallback(() => {
    setRefreshIndex((index) => index + 1);
  }, []);

  const summary = useMemo(() => {
    const counts = items.reduce(
      (acc, product) => {
        acc.total += 1;
        if (product.status === 'low') {
          acc.low += 1;
        } else if (product.status === 'warn') {
          acc.warn += 1;
        } else {
          acc.normal += 1;
        }

        if (product.disabled) {
          acc.disabled += 1;
        }

        return acc;
      },
      {
        total: 0,
        low: 0,
        warn: 0,
        normal: 0,
        disabled: 0,
      },
    );

    return counts;
  }, [items]);

  return {
    items,
    pagination,
    loading,
    error,
    filters,
    setSearch,
    setStatus,
    setDisabledFilter,
    setPage: handleSetPage,
    refresh,
    summary,
  };
}
