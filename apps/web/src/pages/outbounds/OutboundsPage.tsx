import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useOutbounds } from '../../app/hooks/useOutbounds';
import { useAuth } from '../../hooks/useAuth';
import { ProductListItem, fetchProducts } from '../../services/productService';
import {
  OutboundListItem,
  OutboundStatus,
  createOutbound,
  deleteOutbound,
  updateOutbound,
} from '../../services/outboundService';
import { createReturn } from '../../services/returnService';
import { Modal } from '../../components/ui/Modal';
import { downloadCsvTemplate } from '../../lib/downloadTemplate';
import styles from './OutboundsPage.module.css';

const logError = (err: unknown) => {
  if (err instanceof Error) {
    console.error(err);
  } else {
    console.error(new Error(String(err)));
  }
};

const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const sanitizeText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

type ModalMode = 'create' | 'edit';

const statusOptions: Array<{ value: OutboundStatus; label: string }> = [
  { value: 'shipped', label: '출고' },
  { value: 'in_transit', label: '배송중' },
  { value: 'delivered', label: '배송완료' },
  { value: 'returned', label: '반품' },
];

const statusLabelMap = statusOptions.reduce<Record<OutboundStatus, string>>(
  (acc, option) => {
    acc[option.value] = option.label;
    return acc;
  },
  {
    shipped: '출고',
    in_transit: '배송중',
    delivered: '배송완료',
    returned: '반품',
  },
);

const statusFilterOptions: Array<{ value: 'all' | OutboundStatus; label: string }> = [
  { value: 'all', label: '전체 상태' },
  ...statusOptions,
];

interface OutboundFormState {
  productId: string;
  quantity: string;
  orderDate: string;
  dateOut: string;
  status: OutboundStatus;
  ordererId: string;
  ordererName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientPostalCode: string;
  customsNumber: string;
  invoiceNumber: string;
  note: string;
}

const createDefaultOutboundForm = (): OutboundFormState => ({
  productId: '',
  quantity: '',
  orderDate: formatDateTimeLocal(new Date()),
  dateOut: formatDateTimeLocal(new Date()),
  status: 'shipped',
  ordererId: '',
  ordererName: '',
  recipientName: '',
  recipientPhone: '',
  recipientAddress: '',
  recipientPostalCode: '',
  customsNumber: '',
  invoiceNumber: '',
  note: '',
});

const buildFormStateFromOutbound = (outbound: OutboundListItem): OutboundFormState => ({
  productId: outbound.productId,
  quantity: String(outbound.quantity),
  orderDate: outbound.orderDate ? formatDateTimeLocal(new Date(outbound.orderDate)) : '',
  dateOut: outbound.dateOut ? formatDateTimeLocal(new Date(outbound.dateOut)) : formatDateTimeLocal(new Date()),
  status: outbound.status,
  ordererId: outbound.ordererId ?? '',
  ordererName: outbound.ordererName ?? '',
  recipientName: outbound.recipientName ?? '',
  recipientPhone: outbound.recipientPhone ?? '',
  recipientAddress: outbound.recipientAddress ?? '',
  recipientPostalCode: outbound.recipientPostalCode ?? '',
  customsNumber: outbound.customsNumber ?? '',
  invoiceNumber: outbound.invoiceNumber ?? '',
  note: outbound.note ?? '',
});

interface ReturnFormState {
  quantity: string;
  reason: string;
  dateReturn: string;
}

const createDefaultReturnForm = (outbound?: OutboundListItem): ReturnFormState => ({
  quantity: outbound ? String(outbound.quantity) : '',
  reason: '',
  dateReturn: formatDateTimeLocal(new Date()),
});

export function OutboundsPage() {
  const { hasPermission } = useAuth();
  const canRegisterOutbound = hasPermission('outbounds', { write: true });
  const { items, pagination, loading, error, filters, setSearch, setStatus, setPage, refresh, summary } = useOutbounds({
    search: '',
    status: 'all',
  });

  const [searchInput, setSearchInput] = useState(filters.search);
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [editingOutboundId, setEditingOutboundId] = useState<string | null>(null);
  const [formState, setFormState] = useState<OutboundFormState>(() => createDefaultOutboundForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [productOptions, setProductOptions] = useState<ProductListItem[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isReturnModalOpen, setReturnModalOpen] = useState(false);
  const [returnForm, setReturnForm] = useState<ReturnFormState>(() => createDefaultReturnForm());
  const [returningOutbound, setReturningOutbound] = useState<OutboundListItem | null>(null);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

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

  const handleStatusFilterChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as 'all' | OutboundStatus;
    setStatus(value);
    setPage(1);
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
    setEditingOutboundId(null);
    setFormState(createDefaultOutboundForm());
    setFormError(null);
    setActionError(null);
    setModalOpen(true);
  };

  const openEditModal = (outbound: OutboundListItem) => {
    setModalMode('edit');
    setEditingOutboundId(outbound.id);
    setFormState(buildFormStateFromOutbound(outbound));
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
    setEditingOutboundId(null);
    setFormState(createDefaultOutboundForm());
    setFormError(null);
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormError(null);
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
      setFormError('출고 수량은 1 이상의 정수여야 합니다.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    if (modalMode === 'edit' && !editingOutboundId) {
      setSubmitting(false);
      setFormError('수정할 출고 내역을 찾을 수 없습니다. 창을 닫고 다시 시도해 주세요.');
      return;
    }

    const payload = {
      productId: formState.productId,
      quantity: quantityValue,
      orderDate: formState.orderDate ? new Date(formState.orderDate).toISOString() : undefined,
      dateOut: formState.dateOut ? new Date(formState.dateOut).toISOString() : undefined,
      status: formState.status,
      note: sanitizeText(formState.note),
      ordererId: sanitizeText(formState.ordererId),
      ordererName: sanitizeText(formState.ordererName),
      recipientName: sanitizeText(formState.recipientName),
      recipientPhone: sanitizeText(formState.recipientPhone),
      recipientAddress: sanitizeText(formState.recipientAddress),
      recipientPostalCode: sanitizeText(formState.recipientPostalCode),
      customsNumber: sanitizeText(formState.customsNumber),
      invoiceNumber: sanitizeText(formState.invoiceNumber),
    };

    try {
      if (modalMode === 'edit' && editingOutboundId) {
        await updateOutbound(editingOutboundId, payload);
      } else {
        await createOutbound(payload);
        setPage(1);
      }

      setActionError(null);
      setModalOpen(false);
      setModalMode('create');
      setEditingOutboundId(null);
      setFormState(createDefaultOutboundForm());
      refresh();
    } catch (err) {
      const fallbackMessage =
        modalMode === 'edit' ? '출고 수정 중 오류가 발생했습니다.' : '출고 등록 중 오류가 발생했습니다.';
      const message = err instanceof Error ? err.message : fallbackMessage;
      logError(err);
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (outbound: OutboundListItem) => {
    if (!canRegisterOutbound) {
      return;
    }

    const confirmed = window.confirm(
      `제품 "${outbound.productName}"(${outbound.productCode}) 출고 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(outbound.id);
    setActionError(null);

    try {
      await deleteOutbound(outbound.id);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '출고 내역 삭제 중 오류가 발생했습니다.';
      logError(err);
      setActionError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTemplateDownload = () => {
    const now = formatDateTimeLocal(new Date());
    downloadCsvTemplate(
      'outbounds-template.csv',
      [
        'product_code',
        'product_name',
        'unit',
        'quantity',
        'order_date',
        'ship_date',
        'orderer_id',
        'orderer_name',
        'recipient_name',
        'recipient_phone',
        'recipient_address',
        'recipient_postal_code',
        'customs_number',
        'invoice_number',
        'note',
      ],
      [
        [
          'SKU-0002',
          '샘플 제품',
          'EA',
          '5',
          now,
          now,
          'buyer01',
          '홍길동',
          '김수령',
          '010-1234-5678',
          '서울특별시 중구 세종대로 110',
          '04524',
          'P1234567890',
          'INV-20240501-0001',
          '출고 메모',
        ],
      ],
    );
  };

  const openReturnModal = (outbound: OutboundListItem) => {
    setReturningOutbound(outbound);
    setReturnForm(createDefaultReturnForm(outbound));
    setReturnError(null);
    setActionError(null);
    setReturnModalOpen(true);
  };

  const closeReturnModal = () => {
    if (returnSubmitting) {
      return;
    }
    setReturnModalOpen(false);
    setReturningOutbound(null);
    setReturnForm(createDefaultReturnForm());
  };

  const handleReturnFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setReturnError(null);
    setReturnForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleReturnSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!returningOutbound) {
      setReturnError('반품할 출고 내역을 찾을 수 없습니다.');
      return;
    }

    const quantityValue = Number(returnForm.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setReturnError('반품 수량은 1 이상의 정수여야 합니다.');
      return;
    }

    if (quantityValue > returningOutbound.quantity) {
      setReturnError('반품 수량은 출고 수량을 초과할 수 없습니다.');
      return;
    }

    const reason = returnForm.reason.trim();
    if (!reason) {
      setReturnError('반품 사유를 입력해 주세요.');
      return;
    }

    setReturnSubmitting(true);
    setReturnError(null);

    try {
      await createReturn({
        productId: returningOutbound.productId,
        quantity: quantityValue,
        reason,
        status: 'completed',
        dateReturn: returnForm.dateReturn ? new Date(returnForm.dateReturn).toISOString() : undefined,
      });

      await updateOutbound(returningOutbound.id, { status: 'returned' });

      setActionError(null);
      setReturnModalOpen(false);
      setReturningOutbound(null);
      setReturnForm(createDefaultReturnForm());
      setPage(1);
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : '반품 처리 중 오류가 발생했습니다.';
      logError(err);
      setReturnError(message);
      setActionError(message);
    } finally {
      setReturnSubmitting(false);
    }
  };

  const submitButtonLabel = submitting
    ? modalMode === 'edit'
      ? '수정 중...'
      : '등록 중...'
    : modalMode === 'edit'
    ? '수정'
    : '등록';

  const returnSubmitLabel = returnSubmitting ? '반품 처리 중...' : '반품 처리';

  const getStatusBadgeClass = (status: OutboundStatus) => {
    switch (status) {
      case 'in_transit':
        return styles.statusBadgeInTransit;
      case 'delivered':
        return styles.statusBadgeDelivered;
      case 'returned':
        return styles.statusBadgeReturned;
      case 'shipped':
      default:
        return styles.statusBadgeShipped;
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.headerRow}>
        <div>
          <h3>출고 내역</h3>
          <p>출고 기록과 재고 차감을 확인하고 모니터링하세요.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={handleTemplateDownload}>
            출고 템플릿
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canRegisterOutbound}
            onClick={openCreateModal}
          >
            출고 등록
          </button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>총 출고 수량</p>
          <p className={styles.summaryValue}>{summary.totalQuantity.toLocaleString()} EA</p>
          <p className={styles.summarySubtitle}>현재 페이지 기준</p>
        </article>
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>출고 제품 수</p>
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
            placeholder="제품·주문자·송장번호로 검색"
            value={searchInput}
            onChange={handleSearchChange}
          />
          <select
            className={styles.statusSelect}
            value={filters.status}
            onChange={handleStatusFilterChange}
          >
            {statusFilterOptions.map((option) => (
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
              <th>주문일시</th>
              <th>출고일시</th>
              <th>주문자 아이디</th>
              <th>주문자 성명</th>
              <th>제품코드</th>
              <th>제품명</th>
              <th>단위</th>
              <th>수량</th>
              <th>수령자</th>
              <th>전화번호</th>
              <th>주소</th>
              <th>우편번호</th>
              <th>통관번호</th>
              <th>송장번호</th>
              <th>상태</th>
              <th>비고</th>
              <th>등록 시각</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={18}>출고 내역을 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={18}>조건에 맞는 출고 기록이 없습니다.</td>
              </tr>
            ) : (
              items.map((outbound) => (
                <tr key={outbound.id}>
                  <td>{outbound.orderDate ? new Date(outbound.orderDate).toLocaleString() : '-'}</td>
                  <td>{new Date(outbound.dateOut).toLocaleString()}</td>
                  <td>{outbound.ordererId ?? '-'}</td>
                  <td>{outbound.ordererName ?? '-'}</td>
                  <td>{outbound.productCode}</td>
                  <td>{outbound.productName}</td>
                  <td>{outbound.productUnit}</td>
                  <td>{outbound.quantity.toLocaleString()}</td>
                  <td>{outbound.recipientName ?? '-'}</td>
                  <td>{outbound.recipientPhone ?? '-'}</td>
                  <td className={styles.wrapCell}>{outbound.recipientAddress ?? '-'}</td>
                  <td>{outbound.recipientPostalCode ?? '-'}</td>
                  <td>{outbound.customsNumber ?? '-'}</td>
                  <td>{outbound.invoiceNumber ?? '-'}</td>
                  <td>
                    <span className={`${styles.statusBadge} ${getStatusBadgeClass(outbound.status)}`}>
                      {statusLabelMap[outbound.status] ?? outbound.status}
                    </span>
                  </td>
                  <td>{outbound.note ?? '-'}</td>
                  <td>{new Date(outbound.createdAt).toLocaleString()}</td>
                  <td className={styles.actionCell}>
                    {canRegisterOutbound ? (
                      <>
                        <button
                          type="button"
                          className={styles.actionButton}
                          onClick={() => openEditModal(outbound)}
                          disabled={deletingId === outbound.id}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.actionButtonWarning}`}
                          onClick={() => openReturnModal(outbound)}
                          disabled={
                            deletingId === outbound.id ||
                            outbound.status === 'returned' ||
                            (returnSubmitting && returningOutbound?.id === outbound.id)
                          }
                        >
                          {returnSubmitting && returningOutbound?.id === outbound.id ? '반품 중...' : '반품'}
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                          onClick={() => handleDelete(outbound)}
                          disabled={deletingId === outbound.id}
                        >
                          {deletingId === outbound.id ? '삭제 중...' : '삭제'}
                        </button>
                      </>
                    ) : (
                      <span className={styles.actionPlaceholder}>-</span>
                    )}
                  </td>
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
        title={modalMode === 'create' ? '출고 등록' : '출고 수정'}
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
              form="outbound-form"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonPrimary}`}
              disabled={submitting || optionsLoading || !!optionsError}
            >
              {submitButtonLabel}
            </button>
          </>
        }
      >
        <form id="outbound-form" className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.formField}>
            <label htmlFor="outbound-product">제품 선택</label>
            <select
              id="outbound-product"
              name="productId"
              value={formState.productId}
              onChange={handleFormChange}
              className={styles.formSelect}
              disabled={optionsLoading}
              required
            >
              <option value="">{optionsLoading ? '불러오는 중...' : '제품을 선택하세요'}</option>
              {productOptions.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                  disabled={modalMode === 'create' && product.disabled}
                >
                  {product.name} ({product.code})
                  {product.unit ? ` · ${product.unit}` : ''}
                  {product.specification ? ` · ${product.specification}` : ''}
                  {product.disabled ? ' · 비활성화' : ''}
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
            <label htmlFor="outbound-quantity">출고 수량</label>
            <input
              id="outbound-quantity"
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
            <label htmlFor="outbound-order-date">주문일시</label>
            <input
              id="outbound-order-date"
              name="orderDate"
              type="datetime-local"
              value={formState.orderDate}
              onChange={handleFormChange}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-date">출고일시</label>
            <input
              id="outbound-date"
              name="dateOut"
              type="datetime-local"
              value={formState.dateOut}
              onChange={handleFormChange}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-status">상태</label>
            <select
              id="outbound-status"
              name="status"
              value={formState.status}
              onChange={handleFormChange}
              className={styles.formSelect}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-orderer-id">주문자 아이디</label>
            <input
              id="outbound-orderer-id"
              name="ordererId"
              type="text"
              value={formState.ordererId}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="예: user01"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-orderer-name">주문자 성명</label>
            <input
              id="outbound-orderer-name"
              name="ordererName"
              type="text"
              value={formState.ordererName}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="예: 홍길동"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-recipient-name">수령자</label>
            <input
              id="outbound-recipient-name"
              name="recipientName"
              type="text"
              value={formState.recipientName}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="수령자 이름"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-recipient-phone">전화번호</label>
            <input
              id="outbound-recipient-phone"
              name="recipientPhone"
              type="text"
              value={formState.recipientPhone}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="예: 010-1234-5678"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-recipient-address">주소</label>
            <textarea
              id="outbound-recipient-address"
              name="recipientAddress"
              rows={3}
              value={formState.recipientAddress}
              onChange={handleFormChange}
              className={styles.formTextarea}
              placeholder="상세 주소를 입력하세요"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-recipient-postal">우편번호</label>
            <input
              id="outbound-recipient-postal"
              name="recipientPostalCode"
              type="text"
              value={formState.recipientPostalCode}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="예: 04524"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-customs-number">통관번호</label>
            <input
              id="outbound-customs-number"
              name="customsNumber"
              type="text"
              value={formState.customsNumber}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="P로 시작하는 개인통관고유부호"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-invoice-number">송장번호</label>
            <input
              id="outbound-invoice-number"
              name="invoiceNumber"
              type="text"
              value={formState.invoiceNumber}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="택배 송장번호"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-note">비고</label>
            <textarea
              id="outbound-note"
              name="note"
              value={formState.note}
              onChange={handleFormChange}
              className={styles.formTextarea}
              placeholder="비고를 입력하세요 (선택)"
            />
          </div>
          {formError && <p className={styles.errorText}>{formError}</p>}
        </form>
      </Modal>
      <Modal
        open={isReturnModalOpen}
        title="반품 처리"
        onClose={closeReturnModal}
        footer={
          <>
            <button
              type="button"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonSecondary}`}
              onClick={closeReturnModal}
              disabled={returnSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              form="outbound-return-form"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonPrimary}`}
              disabled={returnSubmitting}
            >
              {returnSubmitLabel}
            </button>
          </>
        }
      >
        <form id="outbound-return-form" className={styles.modalForm} onSubmit={handleReturnSubmit}>
          <div className={styles.formField}>
            <label>제품 정보</label>
            <div className={styles.returnMeta}>
              <span>{returningOutbound?.productName ?? '-'}</span>
              <span className={styles.returnMetaCode}>{returningOutbound?.productCode ?? '-'}</span>
            </div>
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-quantity">반품 수량</label>
            <input
              id="return-quantity"
              name="quantity"
              type="number"
              min={1}
              max={returningOutbound?.quantity ?? undefined}
              value={returnForm.quantity}
              onChange={handleReturnFormChange}
              className={styles.formInput}
              placeholder="반품 수량"
              required
            />
            {returningOutbound && (
              <p className={styles.helperText}>최대 {returningOutbound.quantity.toLocaleString()} EA</p>
            )}
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-reason">반품 사유</label>
            <textarea
              id="return-reason"
              name="reason"
              rows={3}
              value={returnForm.reason}
              onChange={handleReturnFormChange}
              className={styles.formTextarea}
              placeholder="반품 사유를 입력하세요"
              required
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="return-date">반품 처리 시각</label>
            <input
              id="return-date"
              name="dateReturn"
              type="datetime-local"
              value={returnForm.dateReturn}
              onChange={handleReturnFormChange}
              className={styles.formInput}
            />
          </div>
          {returnError && <p className={styles.errorText}>{returnError}</p>}
        </form>
      </Modal>
    </div>
  );
}
