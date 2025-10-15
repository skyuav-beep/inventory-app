import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useOutbounds } from '../../app/hooks/useOutbounds';
import { useAuth } from '../../hooks/useAuth';
import { ProductListItem, fetchProducts } from '../../services/productService';
import { createOutbound } from '../../services/outboundService';
import { Modal } from '../../components/ui/Modal';
import { downloadCsvTemplate } from '../../lib/downloadTemplate';
import styles from './OutboundsPage.module.css';

interface OutboundFormState {
  productId: string;
  quantity: string;
  dateOut: string;
  note: string;
}

const createDefaultOutboundForm = (): OutboundFormState => ({
  productId: '',
  quantity: '',
  dateOut: new Date().toISOString().slice(0, 10),
  note: '',
});

export function OutboundsPage() {
  const { hasPermission } = useAuth();
  const canRegisterOutbound = hasPermission('outbounds', { write: true });
  const { items, pagination, loading, error, filters, setSearch, setPage, refresh, summary } = useOutbounds({
    search: '',
  });

  const [searchInput, setSearchInput] = useState(filters.search);
  const [isModalOpen, setModalOpen] = useState(false);
  const [formState, setFormState] = useState<OutboundFormState>(() => createDefaultOutboundForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
      const response = await fetchProducts({ page: 1, size: 200, disabled: false });
      setProductOptions(response.data);
    } catch (err) {
      console.error(err);
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
    setFormState(createDefaultOutboundForm());
    setFormError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) {
      return;
    }
    setModalOpen(false);
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
      setFormError('출고 수량은 1 이상의 정수여야 합니다.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await createOutbound({
        productId: formState.productId,
        quantity: quantityValue,
        dateOut: formState.dateOut ? new Date(formState.dateOut).toISOString() : undefined,
        note: formState.note.trim() ? formState.note.trim() : undefined,
      });

      setModalOpen(false);
      setFormState(createDefaultOutboundForm());
      setPage(1);
      refresh();
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : '출고 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemplateDownload = () => {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsvTemplate('outbounds-template.csv', ['code', 'quantity', 'date', 'note'], [
      ['SKU-0001', '5', today, '출고 비고'],
    ]);
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
            onClick={openModal}
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
              <th>출고일</th>
              <th>제품</th>
              <th>출고 수량</th>
              <th>비고</th>
              <th>등록 시각</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={5}>출고 내역을 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={5}>조건에 맞는 출고 기록이 없습니다.</td>
              </tr>
            ) : (
              items.map((outbound) => (
                <tr key={outbound.id}>
                  <td>{new Date(outbound.dateOut).toLocaleString()}</td>
                  <td>
                    <div className={styles.productNameCell}>
                      <span className={styles.productName}>{outbound.productName}</span>
                      <span className={styles.productCode}>{outbound.productCode}</span>
                    </div>
                  </td>
                  <td>{outbound.quantity.toLocaleString()}</td>
                  <td>{outbound.note ?? '-'}</td>
                  <td>{new Date(outbound.createdAt).toLocaleString()}</td>
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
        title="출고 등록"
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
              form="outbound-create-form"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonPrimary}`}
              disabled={submitting || optionsLoading || !!optionsError}
            >
              {submitting ? '등록 중...' : '등록'}
            </button>
          </>
        }
      >
        <form id="outbound-create-form" className={styles.modalForm} onSubmit={handleSubmit}>
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
                <option key={product.id} value={product.id}>
                  {product.name} ({product.code})
                  {product.unit ? ` · ${product.unit}` : ''}
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
            <label htmlFor="outbound-date">출고일</label>
            <input
              id="outbound-date"
              name="dateOut"
              type="date"
              value={formState.dateOut}
              onChange={handleFormChange}
              className={styles.formInput}
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
    </div>
  );
}
