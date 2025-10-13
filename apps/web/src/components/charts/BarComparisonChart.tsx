import styles from './BarComparisonChart.module.css';

export interface BarComparisonDatum {
  label: string;
  value: number;
  hint?: string;
  color?: string;
}

interface BarComparisonChartProps {
  data: BarComparisonDatum[];
  totalLabel?: string;
}

export function BarComparisonChart({ data, totalLabel }: BarComparisonChartProps) {
  if (data.length === 0) {
    return <p className={styles.empty}>차트 데이터가 없습니다.</p>;
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((acc, item) => acc + item.value, 0);

  return (
    <div className={styles.container}>
      {totalLabel && (
        <div className={styles.totalRow}>
          <span>{totalLabel}</span>
          <strong>{total.toLocaleString()}</strong>
        </div>
      )}
      <ul className={styles.list}>
        {data.map((item) => {
          const width = Math.max(8, (item.value / maxValue) * 100);
          const barStyle: React.CSSProperties = {
            width: `${width}%`,
            background: item.color ?? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          };

          return (
            <li key={item.label}>
              <div className={styles.labelRow}>
                <span className={styles.label}>{item.label}</span>
                <span className={styles.value}>{item.value.toLocaleString()}</span>
              </div>
              <div className={styles.bar} style={barStyle} title={item.hint} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
