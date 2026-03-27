/**
 * Stores all query key information used by TanStack Query
 */
export const queryKeys = {
    donutChart: (params?: { startDate: string; endDate: string }) => ['donutChart', params] as const,

    stackedExpenseChart: (params?: { startDate: string; endDate: string }) => ['stackedExpenseChart', params] as const,

    expenseLineChart: (params?: { startDate: string; endDate: string }) => ['expenseLineChart', params] as const,

    heatMap: (params?: { startDate: string; endDate: string }) => ['heatMap', params] as const,

    income: (params?: { startDate: string; endDate: string }) => ['income', params] as const,
} as const;

export const WIDGET_KEYS = ['donutChart', 'stackedExpenseChart', 'expenseLineChart', 'heatMap'] as const;
