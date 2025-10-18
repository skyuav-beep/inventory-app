import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useReturns } from '../../app/hooks/useReturns';
import {
  ReturnListItem,
  ReturnStatus,
  createReturn,
  deleteReturn,
  updateReturn,
} from '../../services/returnService';
import { ProductListItem, fetchProducts } from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import styles from './ReturnsPage.module.css';

const logError = (err: unknown) => {
  if (err instanceof Error) {
    console.error(err);
  } else {
    console.error(new Error(String(err)));
  }
};

type ModalMode = 'create' | 'edit';

const statusOptions: Array<{ value: ReturnStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체 상태' },
  { value: 'pending', label: '대기' },
  { value: 'completed', label: '완료' },
];

const statusLabels: Record<ReturnStatus, string> = {
  pending: '대기',
  completed: '완료',
};

interface ReturnFormState {
  productId: string;
  quantity: string;
  reason: string;
  status: ReturnStatus;
  dateReturn: string;
  outboundId: string;
}

const createDefaultReturnForm = (): ReturnFormState => ({
  productId: '',
  quantity: '',
  reason: '',
  status: 'pending',
  dateReturn: new Date().toISOString().slice(0, 10),
  outboundId: '',
});

const formatDateOnly = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const buildFormStateFromRecord = (record: ReturnListItem): ReturnFormState => ({
  productId: record.productId,
  quantity: String(record.quantity),
  reason: record.reason,
  status: record.status,
  dateReturn: formatDateOnly(record.dateReturn),
  outboundId: record.outboundId ?? '',
});

export function ReturnsPage() {
  const { hasPermission } = useAuth();
  const canRegisterReturn = hasPermission('returns', { write: true });
  const {
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
  } = useReturns({
    search: '',
    status: 'all',
  });

  const [searchInput, setSearchInput] = useState(filters.search);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingReturnId, setEditingReturnId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ReturnFormState>(() => createDefaultReturnForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [productOptions, setProductOptions] = useState<ProductListItem[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const baseColumnCount = 9;
  const tableColumnCount = canRegisterReturn ? baseColumnCount + 1 : baseColumnCount;

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

  const loadProductOptions = useCallback(async () => {
    try {
      setOptionsLoading(true);
      setOptionsError(null);
      const response = await fetchProducts({ page: 1, size: 200, includeDisabled: true });
      setProductOptions(response.data);
    } catch (err) {
      logError(err);
      setOptionsError('제품 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProductOptions();
  }, [loadProductOptions]);

  useEffect(() => {
    if (isModalOpen && productOptions.length === 0 && !optionsLoading && !optionsError) {
      void loadProductOptions();
    }
  }, [isModalOpen, productOptions.length, optionsLoading, optionsError, loadProductOptions]);

  const openCreateModal = () => {
    setModalMode('create');
    setEditingReturnId(null);
    setFormState(createDefaultReturnForm());
    setFormError(null);
    setActionError(null);
    setModalOpen(true);
  };

  const openEditModal = (record: ReturnListItem) => {
    setModalMode('edit');
    setEditingReturnId(record.id);
    setFormState(buildFormStateFromRecord(record));
    setFormError(null);
    setActionError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }
    setModalOpen(false);
    setModalMode('create');
    setEditingReturnId(null);
    setFormState(createDefaultReturnForm());
    setFormError(null);
    setActionError(null);
  };

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormError(null);
    setActionError(null);
    if (name === 'status') {
      setFormState((prev) => ({
        ...prev,
        status: value as ReturnStatus,
      }));
      return;
    }

    setFormState((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.productId) {
      setFormError('제품을 선택해 주세요.');
      return;
    }

    const quantityValue = Number(formState.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setFormError('반품 수량은 1 이상의 정수여야 합니다.');
      return;
    }

    if (!formState.reason.trim()) {
      setFormError('반품 사유를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    if (modalMode === 'edit' && !editingReturnId) {
      setSubmitting(false);
      setFormError('수정할 반품 내역을 찾을 수 없습니다. 창을 닫고 다시 시도해 주세요.');
      return;
    }

    const payload = {
      productId: formState.productId,
      quantity: quantityValue,
      reason: formState.reason.trim(),
      status: formState.status,
      dateReturn: formState.dateReturn ? new Date(formState.dateReturn).toISOString() : undefined,
      outboundId: formState.outboundId.trim() ? formState.outboundId.trim() : undefined,
    };

    try {
      if (modalMode === 'edit' && editingReturnId) {
        await updateReturn(editingReturnId, payload);
      } else {
        await createReturn(payload);
        setPage(1);
      }

      setActionError(null);
      setModalOpen(false);
      setModalMode('create');
      setEditingReturnId(null);
      setFormState(createDefaultReturnForm());
      refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : modalMode === 'edit'
            ? '반품 수정 중 오류가 발생했습니다.'
            : '반품 등록 중 오류가 발생했습니다.';
      logError(err);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: ReturnListItem) => {
    if (!canRegisterReturn || deletingId) {
      return;
    }

    const confirmed = window.confirm(
      '선택한 반품 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    );
    if (!confirmed) {
      return;
    }

    setDeletingId(record.id);
    setActionError(null);

    try {
      await deleteReturn(record.id);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '반품 삭제 중 오류가 발생했습니다.';
      logError(err);
      setActionError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const submitButtonLabel = submitting
    ? modalMode === 'edit'
      ? '수정 중...'
      : '등록 중...'
    : modalMode === 'edit'
      ? '수정'
      : '등록';

  const modalTitle = modalMode === 'create' ? '반품 등록' : '반품 수정';

  return (
    <div className={styles.container}>
      <header className={styles.headerRow}>
        <div>
          <h3>반품 내역</h3>
          <p>반품 요청 상태를 확인하고 추가 검토 작업을 진행하세요.</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canRegisterReturn}
            onClick={openCreateModal}
          >
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
      {actionError && <div className={styles.errorBanner}>{actionError}</div>}

      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>출고일</th>
              <th>반품일</th>
              <th>제품</th>
              <th>주문자 아이디</th>
              <th>주문자 성명</th>
              <th>수량</th>
              <th>상태</th>
              <th>사유</th>
              <th>등록 시각</th>
              {canRegisterReturn && <th>작업</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={tableColumnCount}>반품 내역을 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={tableColumnCount}>조건에 맞는 반품 기록이 없습니다.</td>
              </tr>
            ) : (
              items.map((record) => (
                <tr key={record.id}>
                  <td>{record.dateOut ? new Date(record.dateOut).toLocaleString() : '-'}</td>
                  <td>{new Date(record.dateReturn).toLocaleString()}</td>
                  <td>
                    <div className={styles.productNameCell}>
                      <span className={styles.productName}>{record.productName}</span>
                      <span className={styles.productCode}>{record.productCode}</span>
                    </div>
                  </td>
                  <td>{record.ordererId ?? '-'}</td>
                  <td>{record.ordererName ?? '-'}</td>
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
                  {canRegisterReturn && (
                    <td className={styles.actionCell}>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => openEditModal(record)}
                        disabled={submitting && editingReturnId === record.id}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                        onClick={() => handleDelete(record)}
                        disabled={deletingId === record.id}
                      >
                        {deletingId === record.id ? '삭제 중...' : '삭제'}
                      </button>
                    </td>
                  )}
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

      <Modal
        open={isModalOpen}
        title={modalTitle}
        onClose={closeModal}
        footer={
          <>
            <button
              type="button"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonSecondary}`}
              onClick={closeModal}
              disabled={submitting}
            >
              취소
            </button>
            <button
              type="submit"
              form="return-form"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonPrimary}`}
              disabled={submitting || optionsLoading || !!optionsError}
            >
              {submitButtonLabel}
            </button>
          </>
        }
      >
        <form id="return-form" className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.formField}>
            <label htmlFor="return-product">제품 선택</label>
            <select
              id="return-product"
              name="productId"
              value={formState.productId}
              onChange={handleFormChange}
              className={styles.formSelect}
              disabled={optionsLoading}
              required
            >
              <option value="">{optionsLoading ? '불러오는 중...' : '제품을 선택하세요'}</option>
              {productOptions.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code}){product.unit ? ` · ${product.unit}` : ''}
                  {product.specification ? ` · ${product.specification}` : ''}
                </option>
              ))}
            </select>
            {optionsError && (
              <div className={styles.errorText}>
                <span>{optionsError}</span>
                <button type="button" onClick={loadProductOptions} className={styles.retryButton}>
                  다시 시도
                </button>
              </div>
            )}
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-outbound-id">연결된 출고 ID (선택)</label>
            <input
              id="return-outbound-id"
              name="outboundId"
              type="text"
              value={formState.outboundId}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="출고 내역 ID (선택 입력)"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-quantity">반품 수량</label>
            <input
              id="return-quantity"
              name="quantity"
              type="number"
              min={1}
              value={formState.quantity}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="1 이상의 정수"
              required
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-status">처리 상태</label>
            <select
              id="return-status"
              name="status"
              value={formState.status}
              onChange={handleFormChange}
              className={styles.formSelect}
            >
              <option value="pending">대기</option>
              <option value="completed">완료</option>
            </select>
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-date">반품일</label>
            <input
              id="return-date"
              name="dateReturn"
              type="date"
              value={formState.dateReturn}
              onChange={handleFormChange}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-reason">반품 사유</label>
            <textarea
              id="return-reason"
              name="reason"
              value={formState.reason}
              onChange={handleFormChange}
              className={styles.formTextarea}
              placeholder="반품 사유를 입력하세요"
              required
            />
          </div>
          {formError && <p className={styles.errorText}>{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
