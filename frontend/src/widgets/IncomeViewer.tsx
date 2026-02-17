import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import ErrorCard from 'components/ErrorCard';
import LoadingCard from 'components/LoadingCard';
import useCurrencyFormatter from 'hooks/useCurrencyFormatter';
import useDateRangeContext from 'hooks/useDateRangeContext';
import useExpenseContext from 'hooks/useExpenseContext';
import { useFetchIncome } from 'hooks/useIncomeQuery';

import EditIncome from './EditIncome';

/**
 * Income Viewer Widget
 * View your total income, pay + extra, versus your total expenses and see the net difference
 * Allows user to modify income via the EditIncome component
 */
export default function IncomeViewer() {
    const { formatCurrency } = useCurrencyFormatter({});
    const { startDate, shortFormattedStartDate, shortFormattedEndDate } = useDateRangeContext();
    const { totalSum } = useExpenseContext();

    /**
     * Tanstack Query hook to fetch income when start/end date change
     */
    const { data, isLoading, isError } = useFetchIncome({
        startDate: shortFormattedStartDate,
        endDate: shortFormattedEndDate,
    });

    if (isLoading) {
        return <LoadingCard />;
    }

    if (isError || !data) {
        return <ErrorCard />;
    }

    const totalIncome = data.pay + data.extra;
    const totalExpenses = totalSum ?? 0;
    const netAmount = totalIncome - totalExpenses;
    const isPositive = totalIncome >= totalExpenses;

    return (
        <Card>
            <CardHeader
                title="Net Income"
                slotProps={{
                    title: {
                        fontSize: '1.25rem',
                    },
                }}
                action={<EditIncome date={startDate} />}
                sx={{ mb: 0, pb: 0 }}
            />
            <CardContent>
                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, lg: 6, xl: 4 }}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h6" component="h5" gutterBottom>
                                    Income
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'success.main' }}>
                                    {formatCurrency(totalIncome)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 6, xl: 4 }}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h6" component="h5" gutterBottom>
                                    Expenses
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'error.main' }}>
                                    -{formatCurrency(totalExpenses)}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, lg: 6, xl: 4 }}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h6" component="h5" gutterBottom>
                                    Net
                                </Typography>
                                <Typography variant="body1" sx={{ color: isPositive ? 'success.main' : 'error.main' }}>
                                    {!isPositive && '-'}
                                    {formatCurrency(Math.abs(netAmount))}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    );
}
