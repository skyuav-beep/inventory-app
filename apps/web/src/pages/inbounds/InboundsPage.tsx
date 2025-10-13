import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { useInbounds } from '../../app/hooks/useInbounds';
import { useAuth } from '../../hooks/useAuth';
import styles from './InboundsPage.module.css';

export function InboundsPage() {
  const { hasPermission } = useAuth();
  const canRegisterInbound = hasPermission('inbounds', { write: true });
  const { items, pagination, loading, error, filters, setSearch, setPage, summary } = useInbounds({
    search: '',
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
          <h3>입고 내역</h3>
          <p>입고 기록과 수량 추이를 확인하고 신규 입고를 등록하세요.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} disabled={!canRegisterInbound}>
            입고 템플릿
          </button>
          <button type="button" className={styles.primaryButton} disabled={!canRegisterInbound}>
            입고 등록
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>총 입고 수량</p>
          <p className={styles.summaryValue}>{summary.totalQuantity.toLocaleString()} EA</p>
          <p className={styles.summarySubtitle}>현재 페이지 기준</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>입고 제품 수</p>
          <p className={styles.summaryValue}>{summary.uniqueProducts.toLocaleString()} 개</p>
          <p className={styles.summarySubtitle}>중복 제외</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>전체 건수</p>
          <p className={styles.summaryValue}>{pagination.total.toLocaleString()} 건</p>
          <p className={styles.summarySubtitle}>서버 전체 데이터</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>페이지 당 표기</p>
          <p className={styles.summaryValue}>{pagination.size} 건</p>
          <p className={styles.summarySubtitle}>기본 목록 크기</p>
        </article>
      </section>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="제품 코드 또는 이름으로 검색"
            value={searchInput}
            onChange={handleSearchChange}
          />
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
              <th>입고일</th>
              <th>제품</th>
              <th>입고 수량</th>
              <th>비고</th>
              <th>등록 시각</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={5}>입고 내역을 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={5}>조건에 맞는 입고 기록이 없습니다.</td>
              </tr>
            ) : (
              items.map((inbound) => (
                <tr key={inbound.id}>
                  <td>{new Date(inbound.dateIn).toLocaleString()}</td>
                  <td>
                    <div className={styles.productNameCell}>
                      <span className={styles.productName}>{inbound.productName}</span>
                      <span className={styles.productCode}>{inbound.productCode}</span>
                    </div>
                  </td>
                  <td>{inbound.quantity.toLocaleString()}</td>
                  <td>{inbound.note ?? '-'}</td>
                  <td>{new Date(inbound.createdAt).toLocaleString()}</td>
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
