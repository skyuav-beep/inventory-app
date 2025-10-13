import { useEffect, useMemo, useState } from 'react';
import {
  fetchAlertLogs,
  fetchDashboardSummary,
  DashboardSummaryResponse,
  DashboardProductItem,
  AlertLogItem,
} from '../../services/dashboardService';
import styles from './DashboardPage.module.css';
import { BarComparisonChart } from '../../components/charts/BarComparisonChart';
import { ShortageBanner } from '../../components/ui/ShortageBanner';

interface SummaryCard {
  title: string;
  value: string;
  subtitle: string;
}

export function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [summaryResponse, alertsResponse] = await Promise.all([
          fetchDashboardSummary(),
          fetchAlertLogs({ size: 5 }),
        ]);

        setSummary(summaryResponse);
        setAlerts(alertsResponse.data);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('대시보드 데이터를 불러올 수 없습니다. 로그인 여부를 확인하거나 잠시 후 다시 시도하세요.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const cards: SummaryCard[] = useMemo(() => {
    if (!summary) {
      return [
        { title: '전체 제품', value: '-', subtitle: '관리 중인 SKU' },
        { title: '안전재고 미달', value: '-', subtitle: '즉시 조치 필요' },
        { title: '총 입고 수량', value: '-', subtitle: '누적 입고' },
        { title: '총 출고 수량', value: '-', subtitle: '누적 출고' },
      ];
    }

    const lowStockCount = summary.lowStock.length;

    return [
      {
        title: '전체 제품',
        value: summary.totals.totalProducts.toLocaleString(),
        subtitle: '관리 중인 SKU',
      },
      {
        title: '안전재고 미달',
        value: lowStockCount.toLocaleString(),
        subtitle: '즉시 조치 필요',
      },
      {
        title: '총 입고 수량',
        value: summary.totals.totalIn.toLocaleString(),
        subtitle: '누적 입고',
      },
      {
        title: '총 출고 수량',
        value: summary.totals.totalOut.toLocaleString(),
        subtitle: '누적 출고',
      },
    ];
  }, [summary]);

  const renderLowStockItems = (items: DashboardProductItem[]) => {
    if (items.length === 0) {
      return <p className={styles.emptyState}>모든 제품이 안전재고 범위 내에 있습니다.</p>;
    }

    return (
      <ul className={styles.lowStockList}>
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <span className={styles.productName}>{item.name}</span>
              <span className={styles.productCode}>{item.code}</span>
            </div>
            <div className={styles.stockBadge} data-status={item.status}>
              {item.remain} / {item.safetyStock}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const renderAlertLogs = (items: AlertLogItem[]) => {
    if (items.length === 0) {
      return <p className={styles.emptyState}>최근 발송된 알림이 없습니다.</p>;
    }

    return (
      <ul className={styles.alertList}>
        {items.map((alert) => (
          <li key={alert.id}>
            <div>
              <span className={styles.alertLevel}>{alert.level.toUpperCase()}</span>
              <span className={styles.alertMessage}>{alert.message}</span>
            </div>
            <span className={styles.alertTimestamp}>
              {alert.sentAt ? new Date(alert.sentAt).toLocaleString() : '발송 대기'}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  const chartData = useMemo(() => {
    if (!summary) {
      return [];
    }

    return [
      {
        label: '총 입고',
        value: summary.totals.totalIn,
        hint: '누적 입고 수량',
        color: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      },
      {
        label: '총 출고',
        value: summary.totals.totalOut,
        hint: '누적 출고 수량',
        color: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
      },
      {
        label: '총 반품',
        value: summary.totals.totalReturn,
        hint: '누적 반품 수량',
        color: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
      },
    ];
  }, [summary]);

  const shortageBannerData = useMemo(() => {
    if (!summary || summary.lowStock.length === 0) {
      return {
        count: 0,
        top: undefined,
      };
    }

    const top = summary.lowStock[0];

    return {
      count: summary.lowStock.length,
      top: {
        name: top.name,
        code: top.code,
        remain: top.remain,
        safetyStock: top.safetyStock,
      },
    };
  }, [summary]);

  return (
    <div className={styles.container}>
      {error && <div className={styles.errorBanner}>{error}</div>}

      {loading ? (
        <div className={styles.loadingState}>대시보드 데이터를 불러오는 중입니다...</div>
      ) : (
        <>
          <section className={styles.summaryGrid}>
            {cards.map((card) => (
              <article key={card.title} className={styles.summaryCard}>
                <p className={styles.summaryTitle}>{card.title}</p>
                <p className={styles.summaryValue}>{card.value}</p>
                <p className={styles.summarySubtitle}>{card.subtitle}</p>
              </article>
            ))}
          </section>

          <section className={styles.insightRow}>
            <ShortageBanner count={shortageBannerData.count} topProduct={shortageBannerData.top} />
            {chartData.length > 0 && (
              <div className={styles.chartCard}>
                <h3>입·출고 추세</h3>
                <BarComparisonChart data={chartData} totalLabel="총 흐름" />
              </div>
            )}
          </section>

          <section className={styles.splitSection}>
            <article className={styles.panel}>
              <header className={styles.panelHeader}>
                <h3>재고 부족 제품</h3>
                <span className={styles.panelBadge}>{summary?.lowStock.length ?? 0} 개</span>
              </header>
              {summary ? renderLowStockItems(summary.lowStock) : <p>데이터 없음</p>}
            </article>
            <article className={styles.panel}>
              <header className={styles.panelHeader}>
                <h3>최근 알림 로그</h3>
                <button type="button" className={styles.textButton}>
                  전체 보기
                </button>
              </header>
              {renderAlertLogs(alerts)}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
