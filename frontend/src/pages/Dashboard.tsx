import Box from '@mui/material/Box';
import Masonry from '@mui/lab/Masonry';
import ExpenseList from 'expense/ExpenseList';
import StackedExpenseChart from 'widgets/StackedExpenseChart';
import SubscriptionList from 'widgets/SubscriptionList';
import DonutChart from 'widgets/DonutChart';
import IncomeViewer from 'widgets/IncomeViewer';
import BulkImport from 'expense/BulkImport';
import useDateRangeContext from 'hooks/useDateRangeContext';
import LineChart from 'widgets/LineChart';
import Export from 'widgets/Export';
import { useMemo } from 'react';

const BASE_WIDGETS = [
    { key: 'expenseList', Component: ExpenseList },
    { key: 'subscriptionList', Component: SubscriptionList },
    { key: 'stackedExpenseChart', Component: StackedExpenseChart },
    { key: 'incomeViewer', Component: IncomeViewer },
    { key: 'donutChart', Component: DonutChart },
    { key: 'bulkImport', Component: BulkImport },
    { key: 'exportData', Component: Export },
];

/**
 * Main dashboard landing page, has various widgets rendered
 */
export default function Dashboard() {
    const { rangeType } = useDateRangeContext();

    // Determine widgets to show based on rangeType
    const DASHBOARD_WIDGETS = useMemo(() => {
        const isYearlyView = rangeType === 'this-year' || rangeType === 'last-year';
        if (!isYearlyView) return BASE_WIDGETS;

        // Insert LineChart before bulkImport widget
        const bulkImportIndex = BASE_WIDGETS.findIndex((w) => w.key === 'bulkImport');
        return [
            ...BASE_WIDGETS.slice(0, bulkImportIndex),
            { key: 'expenseLineChart', Component: LineChart },
            ...BASE_WIDGETS.slice(bulkImportIndex),
        ];
    }, [rangeType]);

    return (
        <Box sx={{ flexGrow: 1, pl: 2, pr: 2, pt: 2 }}>
            <Masonry columns={{ xs: 1, xl: 2 }} sx={{ width: 'auto' }} spacing={3}>
                {DASHBOARD_WIDGETS.map(({ key, Component }) => (
                    <Component key={key} />
                ))}
            </Masonry>
        </Box>
    );
}
