import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ProductDisabledFilter, useProducts } from '../../app/hooks/useProducts';
import type { ProductListItem } from '../../services/productService';
import { ProductStatus, createProduct, updateProduct } from '../../services/productService';
import { useAuth } from '../../hooks/useAuth';
import { Modal } from '../../components/ui/Modal';
import { downloadCsvTemplate } from '../../lib/downloadTemplate';
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

const disabledFilterOptions: Array<{ value: ProductDisabledFilter; label: string }> = [
  { value: 'active', label: '사용 중 제품만' },
  { value: 'with-disabled', label: '사용 중지 포함' },
  { value: 'disabled', label: '사용 중지 제품만' },
];

interface ProductFormState {
  code: string;
  name: string;
  description: string;
  specification: string;
  unit: string;
  safetyStock: string;
  disabled: boolean;
}

const generateProductCode = () => `SKU-${Date.now().toString(36).toUpperCase()}`;

const createDefaultProductForm = (): ProductFormState => ({
  code: generateProductCode(),
  name: '',
  description: '',
  specification: '',
  unit: 'EA',
  safetyStock: '',
  disabled: false,
});

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const canManageProducts = hasPermission('products', { write: true });
  const { items, pagination, loading, error, filters, setSearch, setStatus, setDisabledFilter, setPage, refresh, summary } =
    useProducts({
      search: '',
      status: 'all',
      disabledFilter: 'active',
    });
  const [searchInput, setSearchInput] = useState(filters.search);
  const [isModalOpen, setModalOpen] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(() => createDefaultProductForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [togglingProductId, setTogglingProductId] = useState<string | null>(null);
  const isEditing = editingProductId !== null;

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

  const openCreateModal = () => {
    setEditingProductId(null);
    setProductForm(createDefaultProductForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = useCallback((product: ProductListItem) => {
    setProductForm({
      code: product.code,
      name: product.name,
      description: product.description ?? '',
      specification: product.specification ?? '',
      unit: product.unit ?? 'EA',
      safetyStock: product.safetyStock.toString(),
      disabled: product.disabled,
    });
    setFormError(null);
    setEditingProductId(product.id);
    setModalOpen(true);
  }, []);

  const closeModal = () => {
    if (submitting) {
      return;
    }
    setEditingProductId(null);
    setModalOpen(false);
  };

  const regenerateCode = () => {
    setProductForm((prev) => ({
      ...prev,
      code: generateProductCode(),
    }));
  };

  const handleProductFormChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'code') {
      return;
    }
    setProductForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDisabledToggle = (event: ChangeEvent<HTMLInputElement>) => {
    setProductForm((prev) => ({
      ...prev,
      disabled: event.target.checked,
    }));
  };

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productForm.code.trim() || !productForm.name.trim()) {
      setFormError('제품 코드와 제품명을 입력해 주세요.');
      return;
    }

    let safetyStockValue: number | undefined;
    if (productForm.safetyStock.trim().length > 0) {
      const parsed = Number(productForm.safetyStock.trim());
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFormError('안전 재고 수량은 0 이상의 숫자를 입력해야 합니다.');
        return;
      }
      safetyStockValue = parsed;
    }

    const specificationValue = productForm.specification.trim() || undefined;
    const unitValue = productForm.unit.trim() || 'EA';

    setSubmitting(true);
    setFormError(null);

    try {
      if (isEditing && editingProductId) {
        await updateProduct(editingProductId, {
          name: productForm.name.trim(),
          description: productForm.description.trim() ? productForm.description.trim() : undefined,
          specification: specificationValue,
          unit: unitValue,
          safetyStock: safetyStockValue,
          disabled: productForm.disabled,
        });
      } else {
        await createProduct({
          code: productForm.code.trim(),
          name: productForm.name.trim(),
          description: productForm.description.trim() ? productForm.description.trim() : undefined,
          specification: specificationValue,
          unit: unitValue,
          safetyStock: safetyStockValue,
          disabled: productForm.disabled,
        });
        setPage(1);
      }

      refresh();
      setModalOpen(false);
      setEditingProductId(null);
      setProductForm(createDefaultProductForm());
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : '제품 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (product: ProductListItem) => {
    openEditModal(product);
  };

  const tableColumnCount = canManageProducts ? 12 : 11;

  const handleToggleProductState = async (product: ProductListItem) => {
    if (!canManageProducts || togglingProductId) {
      return;
    }
    setFormError(null);
    setTogglingProductId(product.id);
    try {
      await updateProduct(product.id, {
        disabled: !product.disabled,
      });
      refresh();
    } catch (err) {
      console.error(err);
      setFormError(err instanceof Error ? err.message : '제품 상태 변경 중 오류가 발생했습니다.');
    } finally {
      setTogglingProductId(null);
    }
  };

  const handleTemplateDownload = () => {
    downloadCsvTemplate('products-template.csv', ['code', 'name', 'description', 'specification', 'unit', 'safetyStock'], [
      ['SKU-0001', '샘플 제품', '', '', 'EA', '10'],
    ]);
  };

  const handleProductDownload = (product: ProductListItem) => {
    const headers = [
      '제품코드',
      '제품명',
      '설명',
      '규격',
      '단위',
      '안전재고',
      '현재 재고',
      '총 입고',
      '총 출고',
      '총 반품',
      '상태',
      '사용 여부',
    ];

    const row = [
      product.code,
      product.name,
      product.description ?? '',
      product.specification ?? '',
      product.unit ?? 'EA',
      product.safetyStock.toString(),
      product.remain.toString(),
      product.totalIn.toString(),
      product.totalOut.toString(),
      product.totalReturn.toString(),
      statusLabels[product.status],
      product.disabled ? '사용 중지' : '사용 중',
    ];

    downloadCsvTemplate(`${product.code}_detail.csv`, headers, [row]);
  };

  return (
    <div className={styles.container}>
      <header className={styles.headerRow}>
        <div>
          <h3>제품 목록</h3>
          <p>제품 검색 및 안전재고 관리를 위한 화면입니다.</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.secondaryButton} onClick={handleTemplateDownload}>
            템플릿 다운로드
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!canManageProducts}
            onClick={openCreateModal}
          >
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
        <article className={styles.summaryCard}>
          <p className={styles.summaryTitle}>사용 중지</p>
          <p className={styles.summaryValue}>{summary.disabled.toLocaleString()} 개</p>
          <p className={styles.summarySubtitle}>포함된 목록 기준</p>
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
          <div className={styles.selectField}>
            <select
              value={filters.disabledFilter}
              aria-label="사용 상태 필터"
              onChange={(event) => setDisabledFilter(event.target.value as ProductDisabledFilter)}
              className={styles.select}
            >
              {disabledFilterOptions.map((option) => (
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
              <th>규격</th>
              <th>단위</th>
              <th>안전재고</th>
              <th>현재 재고</th>
              <th>총 입고</th>
              <th>총 출고</th>
              <th>총 반품</th>
              <th>상태</th>
              <th>사용 여부</th>
              {canManageProducts && <th>동작</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className={styles.loadingRow}>
                <td colSpan={tableColumnCount}>제품 정보를 불러오는 중입니다...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr className={styles.emptyRow}>
                <td colSpan={tableColumnCount}>조건에 맞는 제품이 없습니다.</td>
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
                  <tr key={product.id} className={product.disabled ? styles.disabledRow : undefined}>
                    <td>{product.code}</td>
                    <td>
                      <div className={styles.productNameCell}>
                        <span className={styles.productName}>{product.name}</span>
                        <span className={styles.productCode}>{product.code}</span>
                      </div>
                    </td>
                    <td>{product.specification ?? '-'}</td>
                    <td>{product.unit}</td>
                    <td>{product.safetyStock.toLocaleString()}</td>
                    <td>{product.remain.toLocaleString()}</td>
                    <td>{product.totalIn.toLocaleString()}</td>
                    <td>{product.totalOut.toLocaleString()}</td>
                    <td>{product.totalReturn.toLocaleString()}</td>
                    <td>
                      <span className={`${styles.status} ${statusClass}`}>{statusLabels[product.status]}</span>
                    </td>
                    <td>
                      <span className={product.disabled ? styles.disabledBadge : styles.activeBadge}>
                        {product.disabled ? '사용 중지' : '사용 중'}
                      </span>
                    </td>
                    {canManageProducts && (
                      <td className={styles.tableActions}>
                        <div className={styles.tableActionGroup}>
                          <button
                            type="button"
                            className={`${styles.tableActionButton} ${styles.tableActionButtonEdit}`}
                            onClick={() => handleEditClick(product)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className={`${styles.tableActionButton} ${
                              product.disabled
                                ? styles.tableActionButtonToggleEnable
                                : styles.tableActionButtonToggleDisable
                            }`}
                            onClick={() => handleToggleProductState(product)}
                            disabled={togglingProductId === product.id}
                          >
                            {product.disabled
                              ? togglingProductId === product.id
                                ? '해제 중...'
                                : '사용 재개'
                              : togglingProductId === product.id
                                ? '중지 중...'
                                : '사용 중지'}
                          </button>
                          <button
                            type="button"
                            className={`${styles.tableActionButton} ${styles.tableActionButtonDownload}`}
                            onClick={() => handleProductDownload(product)}
                          >
                            다운로드
                          </button>
                        </div>
                      </td>
                    )}
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

      <Modal
        open={isModalOpen}
        title={isEditing ? '제품 수정' : '제품 등록'}
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
              form="product-form"
              className={`${styles.modalFooterButton} ${styles.modalFooterButtonPrimary}`}
              disabled={submitting}
            >
              {submitting ? (isEditing ? '수정 중...' : '등록 중...') : isEditing ? '수정' : '등록'}
            </button>
          </>
        }
      >
        <form id="product-form" className={styles.modalForm} onSubmit={handleProductSubmit}>
          <div className={styles.formField}>
            <div className={styles.labelRow}>
              <label htmlFor="product-code">제품 코드</label>
              {!isEditing && (
                <button type="button" className={styles.linkButton} onClick={regenerateCode} disabled={submitting}>
                  코드 재생성
                </button>
              )}
            </div>
            <input
              id="product-code"
              name="code"
              value={productForm.code}
              className={`${styles.formInput} ${styles.readonlyInput}`}
              readOnly
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="product-name">제품명</label>
            <input
              id="product-name"
              name="name"
              value={productForm.name}
              onChange={handleProductFormChange}
              className={styles.formInput}
              placeholder="제품명을 입력하세요"
              required
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="product-description">제품 설명</label>
            <textarea
              id="product-description"
              name="description"
              value={productForm.description}
              onChange={handleProductFormChange}
              className={styles.formTextarea}
              placeholder="설명을 입력하세요 (선택)"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="product-specification">규격</label>
            <input
              id="product-specification"
              name="specification"
              value={productForm.specification}
              onChange={handleProductFormChange}
              className={styles.formInput}
              placeholder="예: 10x20cm / 500ml"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="product-unit">단위</label>
            <input
              id="product-unit"
              name="unit"
              value={productForm.unit}
              onChange={handleProductFormChange}
              className={styles.formInput}
              placeholder="예: EA, BOX"
            />
          </div>
          <div className={styles.formField}>
            <label htmlFor="product-safety">안전 재고 수량</label>
            <input
              id="product-safety"
              name="safetyStock"
              type="number"
              min={0}
              value={productForm.safetyStock}
              onChange={handleProductFormChange}
              className={styles.formInput}
              placeholder="0 이상 정수"
            />
          </div>
          <div className={styles.formFieldInline}>
            <label className={styles.checkboxLabelInline}>
              <input type="checkbox" checked={productForm.disabled} onChange={handleDisabledToggle} />
              사용 중지
            </label>
            <span className={styles.inlineHelpText}>사용 중지 시 신규 입출고/반품 등록이 제한됩니다.</span>
          </div>
          {formError && <p className={styles.errorText}>{formError}</p>}
        </form>
      </Modal>
    </div>
  );
}
