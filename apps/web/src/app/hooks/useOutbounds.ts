import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FetchOutboundsParams,
  OutboundListItem,
  OutboundListResponse,
  OutboundStatus,
  fetchOutbounds,
} from '../../services/outboundService';

interface UseOutboundsFilters {
  search: string;
  status: 'all' | OutboundStatus;
}

interface UseOutboundsState {
  items: OutboundListItem[];
  pagination: OutboundListResponse['page'];
  loading: boolean;
  error: string | null;
  filters: UseOutboundsFilters;
  setSearch: (value: string) => void;
  setStatus: (value: 'all' | OutboundStatus) => void;
  setPage: (page: number) => void;
  refresh: () => void;
  summary: {
    totalQuantity: number;
    uniqueProducts: number;
  };
}

const DEFAULT_PAGE = { page: 1, size: 20, total: 0 };

export function useOutbounds(
  initialFilters: UseOutboundsFilters = { search: '', status: 'all' },
): UseOutboundsState {
  const resolvedInitialFilters: UseOutboundsFilters = {
    search: initialFilters.search ?? '',
    status: initialFilters.status ?? 'all',
  };
  const [rawItems, setRawItems] = useState<OutboundListItem[]>([]);
  const [items, setItems] = useState<OutboundListItem[]>([]);
  const [pagination, setPagination] = useState<OutboundListResponse['page']>(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<UseOutboundsFilters>(resolvedInitialFilters);
  const [page, setPageState] = useState<number>(DEFAULT_PAGE.page);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const loadOutbounds = useCallback(
    async (params: FetchOutboundsParams) => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchOutbounds(params);
        setRawItems(response.data);
        setPagination(response.page);
      } catch (err) {
        setRawItems([]);
        setPagination(DEFAULT_PAGE);
        setError('출고 내역을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const params: FetchOutboundsParams = {
      page,
      size: DEFAULT_PAGE.size,
      status: filters.status !== 'all' ? filters.status : undefined,
    };
    void loadOutbounds(params);
  }, [loadOutbounds, page, filters.status, refreshIndex]);

  useEffect(() => {
    const filtered = rawItems.filter((item) => {
      if (!filters.search.trim()) {
        return true;
      }

      const keyword = filters.search.trim().toLowerCase();
      return (
        item.productName.toLowerCase().includes(keyword) ||
        item.productCode.toLowerCase().includes(keyword) ||
        item.ordererId?.toLowerCase().includes(keyword) ||
        item.ordererName?.toLowerCase().includes(keyword) ||
        item.recipientName?.toLowerCase().includes(keyword) ||
        item.recipientPhone?.toLowerCase().includes(keyword) ||
        item.invoiceNumber?.toLowerCase().includes(keyword) ||
        item.customsNumber?.toLowerCase().includes(keyword) ||
        item.note?.toLowerCase().includes(keyword)
      );
    });

    setItems(filtered);
  }, [filters.search, rawItems]);

  const setSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
  }, []);

  const setStatus = useCallback((value: 'all' | OutboundStatus) => {
    setFilters((prev) => ({ ...prev, status: value }));
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
