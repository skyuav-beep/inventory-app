import styles from './ShortageBanner.module.css';

interface ShortageBannerProps {
  count: number;
  topProduct?: {
    name: string;
    code: string;
    remain: number;
    safetyStock: number;
  };
}

export function ShortageBanner({ count, topProduct }: ShortageBannerProps) {
  if (count === 0) {
    return (
      <div className={styles.banner} data-status="normal">
        <h3>안전재고를 충분히 확보하고 있습니다.</h3>
        <p>현재 모든 제품이 안전재고 이상을 유지하고 있어요.</p>
      </div>
    );
  }

  return (
    <div className={styles.banner} data-status="alert">
      <h3>재고 부족 제품 {count}건 감지</h3>
      {topProduct ? (
        <p>
          가장 부족한 제품 <strong>{topProduct.name}</strong> ({topProduct.code}) 은 현재{' '}
          <strong>{topProduct.remain}</strong>개 남았으며 안전재고 {topProduct.safetyStock}개가
          필요합니다.
        </p>
      ) : (
        <p>여러 제품이 안전재고 이하로 떨어졌습니다. 재고를 보충해 주세요.</p>
      )}
    </div>
  );
}
