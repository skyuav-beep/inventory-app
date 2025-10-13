import { useCallback, useEffect, useMemo, useState } from 'react';
import { FetchInboundsParams, InboundListItem, InboundListResponse, fetchInbounds } from '../../services/inboundService';

interface UseInboundsFilters {
  search: string;
}

interface UseInboundsState {
  items: InboundListItem[];
  pagination: InboundListResponse['page'];
  loading: boolean;
  error: string | null;
  filters: UseInboundsFilters;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  summary: {
    totalQuantity: number;
    uniqueProducts: number;
  };
}

const DEFAULT_PAGE = { page: 1, size: 20, total: 0 };

export function useInbounds(initialFilters: UseInboundsFilters = { search: '' }): UseInboundsState {
  const [items, setItems] = useState<InboundListItem[]>([]);
  const [pagination, setPagination] = useState<InboundListResponse['page']>(DEFAULT_PAGE);
  const [rawItems, setRawItems] = useState<InboundListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UseInboundsFilters>(initialFilters);
  const [page, setPageState] = useState<number>(DEFAULT_PAGE.page);

  const loadInbounds = useCallback(
    async (params: FetchInboundsParams) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchInbounds(params);
        setRawItems(response.data);
        setPagination(response.page);
      } catch (err) {
        console.error(err);
        setRawItems([]);
        setPagination(DEFAULT_PAGE);
        setError('입고 내역을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadInbounds({ page, size: DEFAULT_PAGE.size });
  }, [loadInbounds, page]);

  useEffect(() => {
    const filtered = rawItems.filter((item) => {
      if (!filters.search.trim()) {
        return true;
      }

      const keyword = filters.search.trim().toLowerCase();
      return (
        item.productName.toLowerCase().includes(keyword) || item.productCode.toLowerCase().includes(keyword)
      );
    });

    setItems(filtered);
  }, [filters.search, rawItems]);

  const setSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  }, []);

  const setPage = useCallback((nextPage: number) => {
    setPageState(nextPage);
  }, []);

  const summary = useMemo(() => {
    const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
    const uniqueProductIds = new Set(items.map((item) => item.productId));

    return {
      totalQuantity,
      uniqueProducts: uniqueProductIds.size,
    };
  }, [items]);

  return {
    items,
    pagination,
    loading,
    error,
    filters,
    setSearch,
    setPage,
    summary,
  };
}

