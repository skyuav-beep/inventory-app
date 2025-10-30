import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { uploadStockFile, UploadJob } from '../../services/uploadService';
import { createReturn } from '../../services/returnService';
import { Modal } from '../../components/ui/Modal';
import { downloadCsvTemplate } from '../../lib/downloadTemplate';
import { downloadExcel } from '../../lib/downloadExcel';
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

const formatDateTimeCell = (value?: string): string => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString();
};

const sanitizeText = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

function getReturnableQuantity(outbound?: OutboundListItem | null): number {
  if (!outbound) {
    return 0;
  }

  if (Number.isFinite(outbound.returnableQuantity)) {
    return Math.max(0, outbound.returnableQuantity);
  }

  if (Number.isFinite(outbound.returnedQuantity)) {
    return Math.max(0, outbound.quantity - outbound.returnedQuantity);
  }

  return Math.max(0, outbound.quantity);
}

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
  status: OutboundStatus;
  ordererName: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientPostalCode: string;
  freightType: string;
  paymentCondition: string;
  specialNote: string;
  memo: string;
}

const createDefaultOutboundForm = (): OutboundFormState => ({
  productId: '',
  quantity: '',
  status: 'shipped',
  ordererName: '',
  recipientName: '',
  recipientPhone: '',
  recipientAddress: '',
  recipientPostalCode: '',
  freightType: '',
  paymentCondition: '',
  specialNote: '',
  memo: '',
});

const buildFormStateFromOutbound = (outbound: OutboundListItem): OutboundFormState => ({
  productId: outbound.productId,
  quantity: String(outbound.quantity),
  status: outbound.status,
  ordererName: outbound.ordererName ?? '',
  recipientName: outbound.recipientName ?? '',
  recipientPhone: outbound.recipientPhone ?? '',
  recipientAddress: outbound.recipientAddress ?? '',
  recipientPostalCode: outbound.recipientPostalCode ?? '',
  freightType: outbound.freightType ?? '',
  paymentCondition: outbound.paymentCondition ?? '',
  specialNote: outbound.specialNote ?? '',
  memo: outbound.memo ?? '',
});

interface ReturnFormState {
  quantity: string;
  reason: string;
  dateReturn: string;
}

const createDefaultReturnForm = (outbound?: OutboundListItem): ReturnFormState => ({
  quantity: outbound ? String(getReturnableQuantity(outbound)) : '',
  reason: '',
  dateReturn: formatDateTimeLocal(new Date()),
});

export function OutboundsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canRegisterOutbound = hasPermission('outbounds', { write: true });
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
  } = useOutbounds({
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
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkJob, setBulkJob] = useState<UploadJob | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const remainingReturnableQuantity = getReturnableQuantity(returningOutbound);
  const requestedReturnQuantityRaw = Number(returnForm.quantity);
  const requestedReturnQuantity =
    Number.isFinite(requestedReturnQuantityRaw) && requestedReturnQuantityRaw > 0
      ? requestedReturnQuantityRaw
      : 0;
  const projectedReturnableAfterSubmit = Math.max(
    0,
    remainingReturnableQuantity - requestedReturnQuantity,
  );
  const completedReturnQuantity = returningOutbound
    ? Number.isFinite(returningOutbound.returnedQuantity)
      ? Math.max(0, returningOutbound.returnedQuantity)
      : Math.max(0, returningOutbound.quantity - remainingReturnableQuantity)
    : 0;

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

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
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
      status: formState.status,
      memo: sanitizeText(formState.memo),
      specialNote: sanitizeText(formState.specialNote),
      freightType: sanitizeText(formState.freightType),
      paymentCondition: sanitizeText(formState.paymentCondition),
      ordererName: sanitizeText(formState.ordererName),
      recipientName: sanitizeText(formState.recipientName),
      recipientPhone: sanitizeText(formState.recipientPhone),
      recipientAddress: sanitizeText(formState.recipientAddress),
      recipientPostalCode: sanitizeText(formState.recipientPostalCode),
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
        modalMode === 'edit'
          ? '출고 수정 중 오류가 발생했습니다.'
          : '출고 등록 중 오류가 발생했습니다.';
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
    const today = new Date().toISOString().slice(0, 10);
    downloadCsvTemplate(
      'outbounds-template.csv',
      [
        '제품코드',
        '제품명',
        '단위',
        '출고수량',
        '출고일',
        '출고상태',
        '주문자',
        '수령자',
        '연락처',
        '주소',
        '우편번호',
        '운임구분',
        '지불조건',
        '특기사항',
        '메모',
      ],
      [
        [
          'SKU-0002',
          '샘플 제품',
          'EA',
          '5',
          today,
          'shipped',
          '홍길동',
          '김수령',
          '010-1234-5678',
          '서울특별시 중구 세종대로 110',
          '04524',
          '선불',
          '후불',
          '파손 주의',
          '수령자 부재 시 문앞 보관',
        ],
      ],
    );
  };

  const handleExcelDownload = () => {
    const headers = [
      '출고일시',
      '주문자 성명',
      '제품코드',
      '제품명',
      '단위',
      '출고 수량',
      '반품 수량',
      '잔여 수량',
      '운임 타입',
      '지불조건',
      '특기사항',
      '메모',
      '수령자',
      '전화번호',
      '주소',
      '우편번호',
      '상태',
      '등록 시각',
    ];

    const rows = items.map((outbound) => {
      const remainingQuantity = getReturnableQuantity(outbound);
      const returnedQuantity = Number.isFinite(outbound.returnedQuantity)
        ? Math.max(0, outbound.returnedQuantity)
        : Math.max(0, outbound.quantity - remainingQuantity);

      return [
        formatDateTimeCell(outbound.dateOut ?? outbound.createdAt),
        outbound.ordererName ?? '',
        outbound.productCode,
        outbound.productName,
        outbound.productUnit,
        outbound.quantity,
        returnedQuantity,
        remainingQuantity,
        outbound.freightType ?? '',
        outbound.paymentCondition ?? '',
        outbound.specialNote ?? '',
        outbound.memo ?? '',
        outbound.recipientName ?? '',
        outbound.recipientPhone ?? '',
        outbound.recipientAddress ?? '',
        outbound.recipientPostalCode ?? '',
        statusLabelMap[outbound.status] ?? outbound.status,
        formatDateTimeCell(outbound.createdAt),
      ];
    });

    const today = new Date().toISOString().split('T')[0];
    downloadExcel(`outbounds_${today}.xlsx`, headers, rows);
  };

  const openBulkModal = () => {
    setBulkModalOpen(true);
    setBulkFile(null);
    setBulkError(null);
    setBulkJob(null);
  };

  const closeBulkModal = () => {
    if (bulkUploading) {
      return;
    }
    setBulkModalOpen(false);
    setBulkFile(null);
    setBulkError(null);
    setBulkJob(null);
    if (bulkFileInputRef.current) {
      bulkFileInputRef.current.value = '';
    }
  };

  const handleBulkFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setBulkFile(nextFile);
    setBulkError(null);
    setBulkJob(null);
  };

  const handleBulkUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bulkFile) {
      setBulkError('업로드할 템플릿 파일을 선택하세요.');
      return;
    }

    try {
      setBulkUploading(true);
      setBulkError(null);
      const response = await uploadStockFile('outbound', bulkFile);
      setBulkJob(response.job);
      setBulkFile(null);
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = '';
      }
    } catch (err) {
      logError(err);
      setBulkJob(null);
      setBulkError(err instanceof Error ? err.message : '대량 출고 업로드 중 오류가 발생했습니다.');
    } finally {
      setBulkUploading(false);
    }
  };

  const goToBulkUploadsPage = () => {
    if (bulkUploading) {
      return;
    }
    closeBulkModal();
    navigate('/uploads?type=outbound');
  };

  const openReturnModal = (outbound: OutboundListItem) => {
    const available = getReturnableQuantity(outbound);
    if (available <= 0) {
      setActionError('이미 모든 수량이 반품 처리되었습니다.');
      return;
    }

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

  const handleReturnFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    const available = getReturnableQuantity(returningOutbound);
    if (available <= 0) {
      setReturnError('더 이상 반품 가능한 수량이 없습니다.');
      return;
    }

    const quantityValue = Number(returnForm.quantity);
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      setReturnError('반품 수량은 1 이상의 정수여야 합니다.');
      return;
    }

    if (quantityValue > available) {
      setReturnError('반품 수량은 남은 반품 가능 수량을 초과할 수 없습니다.');
      return;
    }

    const nextRemainingQuantity = available - quantityValue;
    const shouldMarkReturned = nextRemainingQuantity <= 0;

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
        outboundId: returningOutbound.id,
        dateReturn: returnForm.dateReturn
          ? new Date(returnForm.dateReturn).toISOString()
          : undefined,
      });

      if (shouldMarkReturned && returningOutbound.status !== 'returned') {
        await updateOutbound(returningOutbound.id, { status: 'returned' });
      }

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
          <button type="button" className={styles.secondaryButton} onClick={handleExcelDownload}>
            엑셀 다운로드
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={!canRegisterOutbound}
            onClick={openBulkModal}
          >
            대량 출고 등록
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
          <p className={styles.summaryTitle}>총 반품 수량</p>
          <p className={styles.summaryValue}>{summary.totalReturnedQuantity.toLocaleString()} EA</p>
          <p className={styles.summarySubtitle}>완료된 반품 누적</p>
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
      </section>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="제품·수령자·운임으로 검색"
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
              <th>출고일시</th>
              <th>주문자 성명</th>
              <th>제품코드</th>
              <th>제품명</th>
              <th>단위</th>
              <th>수량</th>
              <th>반품 수량</th>
              <th>잔여 수량</th>
              <th>운임 타입</th>
              <th>지불조건</th>
              <th>특기사항</th>
              <th>메모</th>
              <th>수령자</th>
              <th>전화번호</th>
              <th>주소</th>
              <th>우편번호</th>
              <th>상태</th>
              <th>등록 시각</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={19}>출고 내역을 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={19}>조건에 맞는 출고 기록이 없습니다.</td>
              </tr>
            ) : (
              items.map((outbound) => {
                const remainingQuantity = getReturnableQuantity(outbound);
                const returnedQuantity = Number.isFinite(outbound.returnedQuantity)
                  ? Math.max(0, outbound.returnedQuantity)
                  : Math.max(0, outbound.quantity - remainingQuantity);

                return (
                  <tr key={outbound.id}>
                    <td>{formatDateTimeCell(outbound.dateOut ?? outbound.createdAt)}</td>
                    <td>{outbound.ordererName ?? '-'}</td>
                    <td>{outbound.productCode}</td>
                    <td>{outbound.productName}</td>
                    <td>{outbound.productUnit}</td>
                    <td>{outbound.quantity.toLocaleString()}</td>
                    <td>{returnedQuantity.toLocaleString()}</td>
                    <td>{remainingQuantity.toLocaleString()}</td>
                    <td>{outbound.freightType ?? '-'}</td>
                    <td>{outbound.paymentCondition ?? '-'}</td>
                    <td className={styles.wrapCell}>{outbound.specialNote ?? '-'}</td>
                    <td className={styles.wrapCell}>{outbound.memo ?? '-'}</td>
                    <td>{outbound.recipientName ?? '-'}</td>
                    <td>{outbound.recipientPhone ?? '-'}</td>
                    <td className={styles.wrapCell}>{outbound.recipientAddress ?? '-'}</td>
                    <td>{outbound.recipientPostalCode ?? '-'}</td>
                    <td>
                      <span
                        className={`${styles.statusBadge} ${getStatusBadgeClass(outbound.status)}`}
                      >
                        {statusLabelMap[outbound.status] ?? outbound.status}
                      </span>
                    </td>
                    <td>{formatDateTimeCell(outbound.createdAt)}</td>
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
                              remainingQuantity <= 0 ||
                              (returnSubmitting && returningOutbound?.id === outbound.id)
                            }
                          >
                            {returnSubmitting && returningOutbound?.id === outbound.id
                              ? '반품 중...'
                              : '반품 접수'}
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

      <Modal open={isBulkModalOpen} onClose={closeBulkModal} title="대량 출고 등록" size="lg">
        <form className={styles.bulkForm} onSubmit={handleBulkUpload}>
          <p className={styles.bulkDescription}>
            출고 템플릿(.xlsx, .xls, .csv) 파일을 업로드하면 백그라운드 작업으로 자동 처리됩니다.
          </p>
          <div className={styles.bulkTemplateRow}>
            <span>템플릿이 필요하신가요?</span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleTemplateDownload}
            >
              출고 템플릿 다운로드
            </button>
          </div>
          <label htmlFor="bulk-outbound-file" className={styles.bulkFileInput}>
            <span>템플릿 파일 업로드</span>
            <input
              id="bulk-outbound-file"
              type="file"
              accept=".xlsx,.xls,.csv"
              ref={bulkFileInputRef}
              onChange={handleBulkFileChange}
              disabled={bulkUploading}
            />
          </label>
          {bulkFile && <p className={styles.bulkSelectedFile}>선택된 파일: {bulkFile.name}</p>}
          {bulkError && <p className={styles.errorText}>{bulkError}</p>}
          {bulkJob && (
            <div className={styles.bulkResult}>
              <p>
                업로드 작업이 생성되었습니다. 작업 ID: <code>{bulkJob.id}</code>
              </p>
              <button
                type="button"
                className={styles.linkButton}
                onClick={goToBulkUploadsPage}
                disabled={bulkUploading}
              >
                업로드 내역에서 상태 확인
              </button>
            </div>
          )}
          <div className={styles.bulkModalActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeBulkModal}
              disabled={bulkUploading}
            >
              닫기
            </button>
            <button type="submit" className={styles.primaryButton} disabled={bulkUploading}>
              {bulkUploading ? '업로드 중...' : '업로드'}
            </button>
          </div>
        </form>
      </Modal>

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
                  {product.name} ({product.code}){product.unit ? ` · ${product.unit}` : ''}
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
            <label htmlFor="outbound-freight-type">운임 타입</label>
            <input
              id="outbound-freight-type"
              name="freightType"
              type="text"
              value={formState.freightType}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="예: 선불/착불"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-payment-condition">지불조건</label>
            <input
              id="outbound-payment-condition"
              name="paymentCondition"
              type="text"
              value={formState.paymentCondition}
              onChange={handleFormChange}
              className={styles.formInput}
              placeholder="예: 카드/현금/후불"
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
            <label htmlFor="outbound-special-note">특기사항</label>
            <textarea
              id="outbound-special-note"
              name="specialNote"
              rows={3}
              value={formState.specialNote}
              onChange={handleFormChange}
              className={styles.formTextarea}
              placeholder="특이사항을 입력하세요 (선택)"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="outbound-memo">메모</label>
            <textarea
              id="outbound-memo"
              name="memo"
              rows={3}
              value={formState.memo}
              onChange={handleFormChange}
              className={styles.formTextarea}
              placeholder="내부 메모를 입력하세요 (선택)"
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
              max={remainingReturnableQuantity > 0 ? remainingReturnableQuantity : undefined}
              value={returnForm.quantity}
              onChange={handleReturnFormChange}
              className={styles.formInput}
              placeholder="반품 수량"
              required
            />
            {returningOutbound && (
              <p className={styles.helperText}>
                남은 반품 가능 수량: {remainingReturnableQuantity.toLocaleString()} EA ( 출고{' '}
                {returningOutbound.quantity.toLocaleString()} EA - 완료 반품{' '}
                {completedReturnQuantity.toLocaleString()} EA)
                {requestedReturnQuantity > 0 && (
                  <>
                    {' · '}반품 후 예상 잔여: {projectedReturnableAfterSubmit.toLocaleString()} EA
                  </>
                )}
              </p>
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
