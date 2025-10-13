import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useReturns } from '../../app/hooks/useReturns';
import { ReturnStatus } from '../../services/returnService';
import { useAuth } from '../../hooks/useAuth';
import styles from './ReturnsPage.module.css';

const statusOptions: Array<{ value: ReturnStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체 상태' },
  { value: 'pending', label: '대기' },
  { value: 'completed', label: '완료' },
];

const statusLabels: Record<ReturnStatus, string> = {
  pending: '대기',
  completed: '완료',
};

export function ReturnsPage() {
  const { hasPermission } = useAuth();
  const canRegisterReturn = hasPermission('returns', { write: true });
  const { items, pagination, loading, error, filters, setSearch, setStatus, setPage, summary } = useReturns({
    search: '',
    status: 'all',
  });

  const [searchInput, setSearchInput] = useState(filters.search);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput);
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput, setSearch]);

  const totalPages = useMemo(() => {
    if (pagination.size === 0) {
      return 1;
    }
    return Math.max(1, Math.ceil(pagination.total / pagination.size));
  }, [pagination.size, pagination.total]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  };

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as ReturnStatus | 'all';
    setStatus(value);
  };

  const goPrevious = () => {
    if (pagination.page > 1) {
      setPage(pagination.page - 1);
    }
  };

  const goNext = () => {
    if (pagination.page < totalPages) {
      setPage(pagination.page + 1);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.headerRow}>
        <div>
          <h3>반품 내역</h3>
          <p>반품 요청 상태를 확인하고 추가 검토 작업을 진행하세요.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} disabled={!canRegisterReturn}>
            반품 등록
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>총 반품 수량</p>
          <p className={styles.summaryValue}>{summary.totalQuantity.toLocaleString()} EA</p>
          <p className={styles.summarySubtitle}>현재 페이지 기준</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>완료된 반품</p>
          <p className={styles.summaryValue}>{summary.completedCount.toLocaleString()} 건</p>
          <p className={styles.summarySubtitle}>완료 상태</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>대기 중 반품</p>
          <p className={styles.summaryValue}>{summary.pendingCount.toLocaleString()} 건</p>
          <p className={styles.summarySubtitle}>처리 필요</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>전체 건수</p>
          <p className={styles.summaryValue}>{pagination.total.toLocaleString()} 건</p>
          <p className={styles.summarySubtitle}>서버 전체 데이터</p>
        </article>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="제품/사유로 검색"
            value={searchInput}
            onChange={handleSearchChange}
          />
          <select value={filters.status} onChange={handleStatusChange} className={styles.select}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.meta}>
          <span>
            페이지 {pagination.page} / {totalPages}
          </span>
          <span>총 {pagination.total.toLocaleString()} 건</span>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>반품일</th>
              <th>제품</th>
              <th>수량</th>
              <th>상태</th>
              <th>사유</th>
              <th>등록 시각</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={6}>반품 내역을 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={6}>조건에 맞는 반품 기록이 없습니다.</td>
              </tr>
            ) : (
              items.map((record) => (
                <tr key={record.id}>
                  <td>{new Date(record.dateReturn).toLocaleString()}</td>
                  <td>
                    <div className={styles.productNameCell}>
                      <span className={styles.productName}>{record.productName}</span>
                      <span className={styles.productCode}>{record.productCode}</span>
                    </div>
                  </td>
                  <td>{record.quantity.toLocaleString()}</td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        record.status === 'completed' ? styles.completed : styles.pending
                      }`}
                    >
                      {statusLabels[record.status]}
                    </span>
                  </td>
                  <td>{record.reason}</td>
                  <td>{new Date(record.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button type="button" onClick={goPrevious} disabled={pagination.page <= 1}>
          이전
        </button>
        <span>
          {pagination.page} / {totalPages}
        </span>
        <button type="button" onClick={goNext} disabled={pagination.page >= totalPages}>
          다음
        </button>
      </div>
    </div>
  );
}
