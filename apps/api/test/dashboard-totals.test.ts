import assert from 'node:assert/strict';
import { composeDashboardTotals } from '../src/dashboard/utils/dashboard-totals.util';

export function runDashboardTotalsTests() {
  const totals = composeDashboardTotals(5, {
    totalIn: 120,
    totalOut: 90,
    totalReturn: 15,
  });

  assert.deepEqual(totals, {
    totalProducts: 5,
    totalIn: 120,
    totalOut: 90,
    totalReturn: 15,
  });

  const totalsWithNulls = composeDashboardTotals(0, {
    totalIn: null,
    totalOut: 10,
    totalReturn: null,
  });

  assert.deepEqual(totalsWithNulls, {
    totalProducts: 0,
    totalIn: 0,
    totalOut: 10,
    totalReturn: 0,
  });
}
