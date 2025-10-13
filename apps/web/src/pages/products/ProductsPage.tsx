import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useProducts } from '../../app/hooks/useProducts';
import { ProductStatus } from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import styles from './ProductsPage.module.css';

const statusOptions: Array<{ value: ProductStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체 상태' },
  { value: 'normal', label: '정상' },
  { value: 'warn', label: '주의' },
  { value: 'low', label: '부족' },
];

const statusLabels: Record<ProductStatus, string> = {
  normal: '정상',
  warn: '주의',
  low: '부족',
};

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const canManageProducts = hasPermission('products', { write: true });
  const { items, pagination, loading, error, filters, setSearch, setStatus, setPage, summary } = useProducts({
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
    const value = event.target.value as ProductStatus | 'all';
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
          <h3>제품 목록</h3>
          <p>제품 검색 및 안전재고 관리를 위한 화면입니다.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} disabled={!canManageProducts}>
            템플릿 다운로드
          </button>
          <button type="button" className={styles.primaryButton} disabled={!canManageProducts}>
            제품 등록
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>현재 페이지 제품 수</p>
          <p className={styles.summaryValue}>{summary.total.toLocaleString()} 개</p>
          <p className={styles.summarySubtitle}>전체 {pagination.total.toLocaleString()} 개 중</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>안전재고 부족</p>
          <p className={styles.summaryValue}>{summary.low.toLocaleString()} 개</p>
          <p className={styles.summarySubtitle}>즉시 조치 필요</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>주의 상태</p>
          <p className={styles.summaryValue}>{summary.warn.toLocaleString()} 개</p>
          <p className={styles.summarySubtitle}>추가 모니터링</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>정상 상태</p>
          <p className={styles.summaryValue}>{summary.normal.toLocaleString()} 개</p>
          <p className={styles.summarySubtitle}>안정적인 재고</p>
        </article>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchField}>
            <input
              type="search"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="제품 코드 또는 이름으로 검색"
              className={styles.searchInput}
            />
          </div>
          <div className={styles.selectField}>
            <select value={filters.status ?? 'all'} onChange={handleStatusChange} className={styles.select}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={styles.meta}>
          <span>
            페이지 {pagination.page} / {totalPages}
          </span>
          <span>총 {pagination.total.toLocaleString()} 개</span>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>제품코드</th>
              <th>제품명</th>
              <th>안전재고</th>
              <th>현재 재고</th>
              <th>총 입고</th>
              <th>총 출고</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={7}>제품 정보를 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={7}>조건에 맞는 제품이 없습니다.</td>
              </tr>
            ) : (
              items.map((product) => {
                const statusClass =
                  product.status === 'low'
                    ? styles.statusLow
                    : product.status === 'warn'
                      ? styles.statusWarn
                      : styles.statusNormal;

                return (
                  <tr key={product.id}>
                    <td>{product.code}</td>
                    <td>
                      <div className={styles.productNameCell}>
                        <span className={styles.productName}>{product.name}</span>
                        <span className={styles.productCode}>{product.code}</span>
                      </div>
                    </td>
                    <td>{product.safetyStock.toLocaleString()}</td>
                    <td>{product.remain.toLocaleString()}</td>
                    <td>{product.totalIn.toLocaleString()}</td>
                    <td>{product.totalOut.toLocaleString()}</td>
                    <td>
                      <span className={`${styles.status} ${statusClass}`}>{statusLabels[product.status]}</span>
                    </td>
                  </tr>
                );
              })
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
