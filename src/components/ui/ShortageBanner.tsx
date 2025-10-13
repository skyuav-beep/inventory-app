import styles from './ShortageBanner.module.css';

export interface ShortageBannerProps {
  count: number;
  topProduct?: {
    name: string;
    code: string;
    remain: number;
    safetyStock: number;
  };
}

export function ShortageBanner({ count, topProduct }: ShortageBannerProps) {
  const hasProduct = Boolean(topProduct);
  return (
    <div className={styles.banner} data-has-product={hasProduct}>
      <div className={styles.textBlock}>
        <p className={styles.title}>안전재고 미달 제품 {count}개</p>
        {hasProduct ? (
          <p className={styles.subtitle}>
            지금 바로 <strong>{topProduct?.name}</strong> (#{topProduct?.code}) 재고를 보충하세요. 잔여{' '}
            <strong>{topProduct?.remain}</strong> / 안전재고 {topProduct?.safetyStock}
          </p>
        ) : (
          <p className={styles.subtitle}>현재 모든 제품이 안전재고 이상입니다.</p>
        )}
      </div>
      <button type="button" className={styles.ctaButton}>
        재고 보충 작업 보기
      </button>
    </div>
  );
}

