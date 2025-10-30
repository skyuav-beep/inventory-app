import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AuditAction,
  AuditLogItem,
  AuditResource,
  fetchAuditLogs,
} from '../../services/auditLogService';
import styles from './LogsPage.module.css';

type FilterOption<T extends string> = {
  value: T | 'all';
  label: string;
};

const RESOURCE_LABELS: Record<AuditResource, string> = {
  dashboard: '대시보드',
  products: '제품',
  inbounds: '입고',
  outbounds: '출고',
  returns: '반품',
  settings: '설정',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  create: '생성',
  update: '수정',
  delete: '삭제',
  login: '로그인',
  logout: '로그아웃',
};

const RESOURCE_OPTIONS: Array<FilterOption<AuditResource>> = [
  { value: 'all', label: '모든 리소스' },
  ...Object.entries(RESOURCE_LABELS).map(([value, label]) => ({
    value: value as AuditResource,
    label,
  })),
];

const ACTION_OPTIONS: Array<FilterOption<AuditAction>> = [
  { value: 'all', label: '모든 동작' },
  ...Object.entries(ACTION_LABELS).map(([value, label]) => ({
    value: value as AuditAction,
    label,
  })),
];

const PAGE_SIZE = 20;

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function formatUser(log: AuditLogItem) {
  if (!log.userName && !log.userEmail) {
    return '시스템';
  }

  if (log.userName && log.userEmail) {
    return `${log.userName} (${log.userEmail})`;
  }

  return log.userName ?? log.userEmail ?? '시스템';
}

function formatPayload(payload: unknown) {
  if (!payload) {
    return '-';
  }

  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) {
      return '-';
    }
    return serialized.length > 100 ? `${serialized.slice(0, 97)}…` : serialized;
  } catch {
    return '-';
  }
}

export function LogsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [resourceFilter, setResourceFilter] = useState<AuditResource | 'all'>('all');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchAuditLogs({
        page,
        size: PAGE_SIZE,
        resource: resourceFilter === 'all' ? undefined : resourceFilter,
        action: actionFilter === 'all' ? undefined : actionFilter,
      });
      setLogs(response.data);
      setTotal(response.page.total);
    } catch (err) {
      console.error(err);
      setLogs([]);
      setTotal(0);
      setError('감사 로그를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [page, resourceFilter, actionFilter]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleResourceFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as AuditResource | 'all';
    setResourceFilter(next);
    setPage(1);
  };

  const handleActionFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as AuditAction | 'all';
    setActionFilter(next);
    setPage(1);
  };

  const goPrevious = () => {
    if (page > 1) {
      setPage((prev) => prev - 1);
    }
  };

  const goNext = () => {
    if (page < totalPages) {
      setPage((prev) => prev + 1);
    }
  };

  const activeFilters = (resourceFilter !== 'all' ? 1 : 0) + (actionFilter !== 'all' ? 1 : 0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2>감사 로그</h2>
          <p className={styles.subtitle}>
            주요 자원에 대한 생성/수정/삭제 및 로그인 활동 내역을 확인할 수 있습니다.
          </p>
        </div>
        <div className={styles.meta}>
          <span>
            총 {total.toLocaleString()}건
            {activeFilters > 0 ? ` · 필터 ${activeFilters}개 적용` : ''}
          </span>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={() => void loadLogs()}
            disabled={loading}
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
      </header>

      <section className={styles.filters}>
        <label>
          <span>리소스</span>
          <select value={resourceFilter} onChange={handleResourceFilterChange}>
            {RESOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>동작</span>
          <select value={actionFilter} onChange={handleActionFilterChange}>
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>일시</th>
              <th>사용자</th>
              <th>리소스</th>
              <th>동작</th>
              <th>엔티티 ID</th>
              <th>세부 정보</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className={styles.loadingCell}>
                  감사 로그를 불러오는 중입니다...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyCell}>
                  조건에 맞는 감사 로그가 없습니다.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>
                  <td>{formatUser(log)}</td>
                  <td>{RESOURCE_LABELS[log.resource]}</td>
                  <td>{ACTION_LABELS[log.action]}</td>
                  <td>{log.entityId ?? '-'}</td>
                  <td className={styles.payloadCell}>{formatPayload(log.payload)}</td>
                  <td>{log.ipAddress ?? '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button type="button" onClick={goPrevious} disabled={page <= 1 || loading}>
          이전
        </button>
        <span>
          페이지 {page} / {totalPages}
        </span>
        <button type="button" onClick={goNext} disabled={page >= totalPages || loading}>
          다음
        </button>
      </div>
    </div>
  );
}
