import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInbounds } from '../../app/hooks/useInbounds';
import { useAuth } from '../../hooks/useAuth';
import { ProductListItem, fetchProducts } from '../../services/productService';
import {
  createInbound,
  deleteInbound,
  InboundListItem,
  updateInbound,
} from '../../services/inboundService';
import { uploadStockFile, UploadJob } from '../../services/uploadService';
import { Modal } from '../../components/ui/Modal';
import { downloadCsvTemplate } from '../../lib/downloadTemplate';
import { downloadExcel } from '../../lib/downloadExcel';
import styles from './InboundsPage.module.css';

const logError = (err: unknown) => {
  if (err instanceof Error) {
    console.error(err);
  } else {
    console.error(new Error(String(err)));
  }
};

interface InboundFormState {
  productId: string;
  quantity: string;
  dateIn: string;
  note: string;
}

const formatDateInputValue = (value: string): string => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const createDefaultInboundForm = (): InboundFormState => ({
  productId: '',
  quantity: '',
  dateIn: new Date().toISOString().slice(0, 10),
  note: '',
});

const buildFormStateFromInbound = (inbound: InboundListItem): InboundFormState => ({
  productId: inbound.productId,
  quantity: String(inbound.quantity),
  dateIn: formatDateInputValue(inbound.dateIn),
  note: inbound.note ?? '',
});

export function InboundsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const canRegisterInbound = hasPermission('inbounds', { write: true });
  const { items, pagination, loading, error, filters, setSearch, setPage, refresh, summary } =
    useInbounds({
      search: '',
    });

  const [searchInput, setSearchInput] = useState(filters.search);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [formState, setFormState] = useState<InboundFormState>(() => createDefaultInboundForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkJob, setBulkJob] = useState<UploadJob | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement | null>(null);
  const [editingInboundId, setEditingInboundId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isEditing = modalMode === 'edit';
  const tableColumnCount = canRegisterInbound ? 6 : 5;
  const [productOptions, setProductOptions] = useState<ProductListItem[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

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

  const openModal = () => {
    setModalMode('create');
    setEditingInboundId(null);
    setFormState(createDefaultInboundForm());
    setFormError(null);
    setActionError(null);
    setOptionsError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }
    setModalMode('create');
    setEditingInboundId(null);
    setFormState(createDefaultInboundForm());
    setFormError(null);
    setModalOpen(false);
  };

  const openEditModal = (inbound: InboundListItem) => {
    setModalMode('edit');
    setEditingInboundId(inbound.id);
    setFormState(buildFormStateFromInbound(inbound));
    setFormError(null);
    setActionError(null);
    setOptionsError(null);
    setModalOpen(true);
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
      const response = await uploadStockFile('inbound', bulkFile);
      setBulkJob(response.job);
      setBulkFile(null);
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = '';
      }
    } catch (err) {
      logError(err);
      setBulkJob(null);
      setBulkError(err instanceof Error ? err.message : '대량 입고 업로드 중 오류가 발생했습니다.');
    } finally {
      setBulkUploading(false);
    }
  };

  const goToUploadsPage = () => {
    if (bulkUploading) {
      return;
    }
    closeBulkModal();
    navigate('/uploads?type=inbound');
  };

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
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
      setFormError('입고 수량은 1 이상의 정수여야 합니다.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const payload = {
      productId: formState.productId,
      quantity: quantityValue,
      dateIn: formState.dateIn ? new Date(formState.dateIn).toISOString() : undefined,
      note: formState.note.trim() ? formState.note.trim() : undefined,
    };

    try {
      if (isEditing && editingInboundId) {
        await updateInbound(editingInboundId, payload);
      } else {
        await createInbound(payload);
        setPage(1);
      }

      setModalOpen(false);
      setModalMode('create');
      setEditingInboundId(null);
      setFormState(createDefaultInboundForm());
      setActionError(null);
      refresh();
    } catch (err) {
      logError(err);
      const defaultMessage = isEditing
        ? '입고 수정 중 오류가 발생했습니다.'
        : '입고 등록 중 오류가 발생했습니다.';
      setFormError(err instanceof Error ? err.message : defaultMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemplateDownload = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsvTemplate(
      'inbounds-template.csv',
      ['제품코드', '입고수량', '입고일', '비고'],
      [['SKU-0001', '10', today, '메모']],
    );
  };

  const handleExcelDownload = () => {
    const headers = ['입고일', '제품코드', '제품명', '입고 수량', '비고', '등록 시각'];
    const rows = items.map((inbound) => [
      new Date(inbound.dateIn).toLocaleString(),
      inbound.productCode,
      inbound.productName,
      inbound.quantity,
      inbound.note ?? '',
      new Date(inbound.createdAt).toLocaleString(),
    ]);

    const today = new Date().toISOString().split('T')[0];
    downloadExcel(`inbounds_${today}.xlsx`, headers, rows);
  };

  const handleDelete = async (inbound: InboundListItem) => {
    if (!canRegisterInbound) {
      return;
    }

    const confirmed = window.confirm(
      `제품 "${inbound.productName}"(${inbound.productCode}) 입고 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(inbound.id);
    setActionError(null);

    try {
      await deleteInbound(inbound.id);
      refresh();
    } catch (err) {
      logError(err);
      const message = err instanceof Error ? err.message : '입고 내역 삭제 중 오류가 발생했습니다.';
      setActionError(message);
    } finally {
      setDeletingId(null);
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
          <button type="button" className={styles.secondaryButton} onClick={handleExcelDownload}>
            엑셀 다운로드
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={!canRegisterInbound}
            onClick={openBulkModal}
          >
            대량 입고 등록
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canRegisterInbound}
            onClick={openModal}
          >
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
      {actionError && <div className={styles.errorBanner}>{actionError}</div>}

      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>입고일</th>
              <th>제품</th>
              <th>입고 수량</th>
              <th>비고</th>
              <th>등록 시각</th>
              {canRegisterInbound && <th>작업</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={tableColumnCount}>입고 내역을 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={tableColumnCount}>조건에 맞는 입고 기록이 없습니다.</td>
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
                  {canRegisterInbound && (
                    <td className={styles.actionCell}>
                      <button
                        type="button"
                        className={styles.actionButton}
                        onClick={() => openEditModal(inbound)}
                        disabled={submitting || deletingId === inbound.id}
                      >
                        {submitting && editingInboundId === inbound.id ? '수정 중...' : '수정'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionButton} ${styles.actionButtonDanger}`}
                        onClick={() => handleDelete(inbound)}
                        disabled={deletingId === inbound.id || submitting}
                      >
                        {deletingId === inbound.id ? '삭제 중...' : '삭제'}
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

      <Modal open={isBulkModalOpen} onClose={closeBulkModal} title="대량 입고 등록" size="lg">
        <form className={styles.bulkForm} onSubmit={handleBulkUpload}>
          <p className={styles.bulkDescription}>
            입고 템플릿(.xlsx, .xls, .csv) 파일을 업로드하면 백그라운드 작업으로 자동 등록됩니다.
          </p>
          <div className={styles.bulkTemplateRow}>
            <span>템플릿이 필요하신가요?</span>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleTemplateDownload}
            >
              입고 템플릿 다운로드
            </button>
          </div>
          <label htmlFor="bulk-inbound-file" className={styles.bulkFileInput}>
            <span>템플릿 파일 업로드</span>
            <input
              id="bulk-inbound-file"
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
                onClick={goToUploadsPage}
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
        title={isEditing ? '입고 수정' : '입고 등록'}
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
              form="inbound-form"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonPrimary}`}
              disabled={submitting || optionsLoading || !!optionsError}
            >
              {submitting ? (isEditing ? '수정 중...' : '등록 중...') : isEditing ? '수정' : '등록'}
            </button>
          </>
        }
      >
        <form id="inbound-form" className={styles.modalForm} onSubmit={handleSubmit}>
          <div className={styles.formField}>
            <label htmlFor="inbound-product">제품 선택</label>
            <select
              id="inbound-product"
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
                <button
                  type="button"
                  onClick={() => void loadProductOptions()}
                  className={styles.retryButton}
                >
                  다시 시도
                </button>
              </div>
            )}
          </div>
          <div className={styles.formField}>
            <label htmlFor="inbound-quantity">입고 수량</label>
            <input
              id="inbound-quantity"
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
            <label htmlFor="inbound-date">입고일</label>
            <input
              id="inbound-date"
              name="dateIn"
              type="date"
              value={formState.dateIn}
              onChange={handleFormChange}
              className={styles.formInput}
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="inbound-note">비고</label>
            <textarea
              id="inbound-note"
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
    </div>
  );
}
