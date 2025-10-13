interface AggregateSums {
  totalIn: number | null;
  totalOut: number | null;
  totalReturn: number | null;
}

export interface DashboardTotals {
  totalProducts: number;
  totalIn: number;
  totalOut: number;
  totalReturn: number;
}

export function composeDashboardTotals(totalProducts: number, aggregate: AggregateSums): DashboardTotals {
  return {
    totalProducts,
    totalIn: aggregate.totalIn ?? 0,
    totalOut: aggregate.totalOut ?? 0,
    totalReturn: aggregate.totalReturn ?? 0,
  };
}
