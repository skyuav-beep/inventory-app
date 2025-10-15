import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchUsers, UserListItem, UserListResponse } from '../../services/userService';

interface UseUsersState {
  items: UserListItem[];
  pagination: UserListResponse['page'];
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  refresh: () => void;
}

const DEFAULT_PAGE = { page: 1, size: 10, total: 0 };

export function useUsers(): UseUsersState {
  const [items, setItems] = useState<UserListItem[]>([]);
  const [pagination, setPagination] = useState<UserListResponse['page']>(DEFAULT_PAGE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageState] = useState<number>(DEFAULT_PAGE.page);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchUsers({ page, size: DEFAULT_PAGE.size });
      setItems(response.data);
      setPagination(response.page);
    } catch (err) {
      console.error(err);
      setItems([]);
      setPagination(DEFAULT_PAGE);
      setError('사용자 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers, refreshIndex]);

  const totalPages = useMemo(() => {
    if (pagination.size === 0) {
      return 1;
    }

    return Math.max(1, Math.ceil(pagination.total / pagination.size));
  }, [pagination.size, pagination.total]);

  const setPage = useCallback(
    (nextPage: number) => {
      if (nextPage < 1 || nextPage > totalPages) {
        return;
      }
      setPageState(nextPage);
    },
    [totalPages],
  );

  const refresh = useCallback(() => {
    setRefreshIndex((index) => index + 1);
  }, []);

  return {
    items,
    pagination,
    loading,
    error,
    setPage,
    refresh,
  };
}
