import styles from './BarComparisonChart.module.css';

export interface ComparisonDatum {
  label: string;
  value: number;
  hint?: string;
  color?: string;
}

interface BarComparisonChartProps {
  data: ComparisonDatum[];
  totalLabel?: string;
}

export function BarComparisonChart({ data, totalLabel = '합계' }: BarComparisonChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className={styles.chartRoot}>
      <div className={styles.summaryRow}>
        <span className={styles.summaryLabel}>{totalLabel}</span>
        <span className={styles.summaryValue}>{total.toLocaleString()} EA</span>
      </div>
      <ul className={styles.barList}>
        {data.map((item) => {
          const percentage = Math.round((item.value / maxValue) * 100);
          return (
            <li key={item.label} className={styles.barItem}>
              <div className={styles.barMeta}>
                <span className={styles.barLabel}>{item.label}</span>
                <span className={styles.barValue}>{item.value.toLocaleString()} EA</span>
              </div>
              <div className={styles.barTrack} aria-hidden>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${percentage}%`,
                    background: item.color,
                  }}
                />
              </div>
              {item.hint && <p className={styles.barHint}>{item.hint}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

