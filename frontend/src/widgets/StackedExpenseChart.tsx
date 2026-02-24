import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { useQuery } from '@tanstack/react-query';
import type { ChartData, ChartDataset, ChartOptions, LegendItem } from 'chart.js';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import EmptyCard from 'components/EmptyCard';
import ErrorCard from 'components/ErrorCard';
import LoadingCard from 'components/LoadingCard';
import useAuthFetch from 'hooks/useAuthFetch';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { barPlugins, pointerHover } from 'utils/chartPlugins';
import { queryKeys } from 'utils/queryKeys';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface StackedExpenseChartResponse {
    data: {
        labels: string[];
        datasets: ChartDataset<'bar'>[];
    };
    error?: boolean;
}

/**
 * ChartJS options
 */
const options: ChartOptions<'bar'> = {
    responsive: true,
    scales: {
        x: {
            stacked: true,
            border: {
                color: '#a9a9a9',
            },
            grid: {
                color: 'transparent',
            },
            ticks: {
                color: '#dee2e6',
            },
        },
        y: {
            stacked: true,
            border: {
                color: '#a9a9a9',
            },
            grid: {
                color: 'transparent',
            },
            ticks: {
                color: '#dee2e6',
            },
            grace: '5%',
        },
    },
    plugins: {
        legend: {
            position: 'top',
            labels: {
                color: '#dee2e6',
                sort: (a: LegendItem, b: LegendItem) => {
                    return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
                },
            },
            onHover: barPlugins.handleHover,
            onLeave: barPlugins.handleLeave,
        },
        tooltip: {
            mode: 'point',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#666',
            borderWidth: 1,
            displayColors: true,
            intersect: true,
            callbacks: {
                label: barPlugins.labels.number,
                footer: barPlugins.footer,
                title: barPlugins.title,
            },
        },
    },
    interaction: {
        mode: 'point',
        intersect: true,
    },
    onHover: pointerHover,
    maintainAspectRatio: false,
    devicePixelRatio: window.devicePixelRatio || 2,
};

/**
 * Displays stacked expenses by category over the selected date range
 */
export default function StackedExpenseChart() {
    const { formattedStartDate, formattedEndDate } = useDateRangeContext();
    const authFetch = useAuthFetch();

    /**
     * Additional params used by API
     */
    const additionalParams = useMemo(
        () => ({
            startDate: formattedStartDate,
            endDate: formattedEndDate,
        }),
        [formattedStartDate, formattedEndDate]
    );

    /**
     * Fetch function for TanStack Query
     */
    const fetchStackedExpenseChart = async ({ signal }: { signal: AbortSignal }): Promise<ChartData<'bar'>> => {
        const urlParams = new URLSearchParams(additionalParams);
        const response = await authFetch({
            url: `/spendingtracker/api/v1/widgets/stackedBarChart?${urlParams.toString()}`,
            method: 'GET',
            signal: signal,
        });

        if (!response) throw new Error('No response');
        if (!response.ok) throw new Error('Invalid network response');

        const result = (await response.json()) as StackedExpenseChartResponse;
        if (result?.error ?? false) throw new Error('Bad Request');

        return {
            labels: result.data.labels,
            datasets: result.data.datasets,
        };
    };

    /**
     * TanStack Query hook - automatically handles loading, error, caching, and refetching
     */
    const {
        data: chartData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: queryKeys.stackedExpenseChart(additionalParams),
        queryFn: fetchStackedExpenseChart,
    });

    if (isLoading) {
        return <LoadingCard />;
    }

    if (isError) {
        return <ErrorCard />;
    }

    if (!chartData?.datasets?.length) {
        return <EmptyCard />;
    }

    return (
        <Card>
            <CardHeader
                title="Expenses Over Time"
                slotProps={{
                    title: {
                        fontSize: '1.25rem',
                    },
                }}
                sx={{ mb: 0, pb: 0 }}
            />

            <CardContent sx={{ minHeight: 500 }}>
                <Bar options={options} data={chartData} plugins={[barPlugins.totalSumLabel]} />
            </CardContent>
        </Card>
    );
}
