import Box from '@mui/material/Box';
import Masonry from '@mui/lab/Masonry';
import ExpenseList from 'expense/ExpenseList';
import StackedExpenseChart from 'widgets/StackedExpenseChart';
import SubscriptionList from 'widgets/SubscriptionList';
import DonutChart from 'widgets/DonutChart';
import IncomeViewer from 'widgets/IncomeViewer';
import BulkImport from 'expense/BulkImport';

const WIDGETS = [
    { key: 'expenseList', Component: ExpenseList },
    { key: 'subscriptionList', Component: SubscriptionList },
    { key: 'stackedExpenseChart', Component: StackedExpenseChart },
    { key: 'incomeViewer', Component: IncomeViewer },
    { key: 'donutChart', Component: DonutChart },
    { key: 'bulkImport', Component: BulkImport },
];

/**
 * Main dashboard landing page, has various widgets rendered
 */
export default function Dashboard() {
    return (
        <Box sx={{ flexGrow: 1, pl: 2, pr: 2, pt: 2 }}>
            <Masonry columns={{ xs: 1, xl: 2 }} sx={{ width: 'auto' }} spacing={3}>
                {WIDGETS.map(({ key, Component }) => (
                    <Component key={key} />
                ))}
            </Masonry>
        </Box>
    );
}
