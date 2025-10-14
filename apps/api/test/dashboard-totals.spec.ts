import { composeDashboardTotals } from '../src/dashboard/utils/dashboard-totals.util';

describe('composeDashboardTotals', () => {
  it('should return totals when all aggregates are present', () => {
    const totals = composeDashboardTotals(5, {
      totalIn: 120,
      totalOut: 90,
      totalReturn: 15,
    });

    expect(totals).toEqual({
      totalProducts: 5,
      totalIn: 120,
      totalOut: 90,
      totalReturn: 15,
    });
  });

  it('should fallback to zero when aggregate values are null', () => {
    const totals = composeDashboardTotals(0, {
      totalIn: null,
      totalOut: 10,
      totalReturn: null,
    });

    expect(totals).toEqual({
      totalProducts: 0,
      totalIn: 0,
      totalOut: 10,
      totalReturn: 0,
    });
  });
});
