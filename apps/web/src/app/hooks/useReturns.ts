import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FetchReturnsParams,
  ReturnListItem,
  ReturnListResponse,
  ReturnStatus,
  fetchReturns,
} from '../../services/returnService';

const logError = (err: unknown) => {
  if (err instanceof Error) {
    console.error(err);
  } else {
    console.error(new Error(String(err)));
  }
};

interface UseReturnsFilters {
  search: string;
  status: ReturnStatus | 'all';
}

interface UseReturnsState {
  items: ReturnListItem[];
  pagination: ReturnListResponse['page'];
  loading: boolean;
  error: string | null;
  filters: UseReturnsFilters;
  setSearch: (value: string) => void;
  setStatus: (status: ReturnStatus | 'all') => void;
  setPage: (page: number) => void;
  refresh: () => void;
  summary: {
    totalQuantity: number;
    completedCount: number;
    pendingCount: number;
  };
}

const DEFAULT_PAGE = { page: 1, size: 20, total: 0 };

export function useReturns(initialFilters: UseReturnsFilters = { search: '', status: 'all' }): UseReturnsState {
  const [rawItems, setRawItems] = useState<ReturnListItem[]>([]);
  const [items, setItems] = useState<ReturnListItem[]>([]);
  const [pagination, setPagination] = useState<ReturnListResponse['page']>(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UseReturnsFilters>(initialFilters);
  const [page, setPageState] = useState<number>(DEFAULT_PAGE.page);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const loadReturns = useCallback(
    async (params: FetchReturnsParams) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchReturns(params);
        setRawItems(response.data);
        setPagination(response.page);
      } catch (err) {
        logError(err);
        setRawItems([]);
        setPagination(DEFAULT_PAGE);
        setError('반품 내역을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const params: FetchReturnsParams = {
      page,
      size: DEFAULT_PAGE.size,
      status: filters.status !== 'all' ? filters.status : undefined,
    };

    void loadReturns(params);
  }, [filters.status, loadReturns, page, refreshIndex]);

  useEffect(() => {
    const filtered = rawItems.filter((item) => {
      if (!filters.search.trim()) {
        return true;
      }

      const keyword = filters.search.trim().toLowerCase();
      return (
        item.productName.toLowerCase().includes(keyword) ||
        item.productCode.toLowerCase().includes(keyword) ||
        item.reason.toLowerCase().includes(keyword) ||
        (item.ordererId?.toLowerCase().includes(keyword) ?? false) ||
        (item.ordererName?.toLowerCase().includes(keyword) ?? false)
      );
    });

    setItems(filtered);
  }, [filters.search, rawItems]);

  const setSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  }, []);

  const setStatus = useCallback((status: ReturnStatus | 'all') => {
    setFilters((prev) => ({ ...prev, status }));
    setPageState(1);
  }, []);

  const setPage = useCallback((nextPage: number) => {
    setPageState(nextPage);
  }, []);

  const summary = useMemo(() => {
    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
    const completedCount = items.filter((item) => item.status === 'completed').length;
    const pendingCount = items.filter((item) => item.status === 'pending').length;

    return {
      totalQuantity,
      completedCount,
      pendingCount,
    };
  }, [items]);

  const refresh = useCallback(() => {
    setRefreshIndex((index) => index + 1);
  }, []);

  return {
    items,
    pagination,
    loading,
    error,
    filters,
    setSearch,
    setStatus,
    setPage,
    refresh,
    summary,
  };
}
