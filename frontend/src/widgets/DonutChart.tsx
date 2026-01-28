import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import useDateRangeContext from 'hooks/useDateRangeContext';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import type { ChartData, ChartDataset, ChartOptions, LegendItem } from 'chart.js';
import LoadingCard from 'components/LoadingCard';
import ErrorCard from 'components/ErrorCard';
import EmptyCard from 'components/EmptyCard';
import useAuthFetch from 'hooks/useAuthFetch';
import { queryKeys } from 'utils/queryKeys';
import { pointerHover, donutPlugins } from 'utils/chartPlugins';
import CardHeader from '@mui/material/CardHeader';

ChartJS.register(ArcElement, Tooltip, Legend);

interface DonutChartResponse {
    data: {
        labels: string[];
        dataset: ChartDataset<'doughnut'>;
    };
    error?: boolean;
}

/**
 * ChartJS options
 */
const options: ChartOptions<'doughnut'> = {
    responsive: true,
    animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeInOutQuart',
    },
    plugins: {
        legend: {
            position: 'top',
            labels: {
                color: '#dee2e6',
                sort: (a: LegendItem, b: LegendItem): number => {
                    return a.text.toLowerCase().localeCompare(b.text.toLowerCase());
                },
            },
            onHover: donutPlugins.handleHover,
            onLeave: donutPlugins.handleLeave,
        },
        tooltip: { ...donutPlugins.tooltip, callbacks: { label: donutPlugins.labels.money } },
    },
    cutout: `60%`,
    onHover: pointerHover,
    maintainAspectRatio: false,
    devicePixelRatio: window.devicePixelRatio || 2,
};

/**
 * Donut chart showing breakdown of expenses by category
 */
export default function DonutChart() {
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
    const fetchDonutChartData = async ({ signal }: { signal: AbortSignal }): Promise<ChartData<'doughnut'>> => {
        const urlParams = new URLSearchParams(additionalParams);
        const response = await authFetch({
            url: `/spendingtracker/api/v1/widgets/donutChart?${urlParams.toString()}`,
            method: 'GET',
            signal: signal,
        });

        if (!response) throw new Error('No response');
        if (!response.ok) throw new Error('Invalid network response');

        const result = (await response.json()) as DonutChartResponse;
        if (result?.error ?? false) throw new Error('Bad Request');

        return {
            labels: result.data.labels,
            datasets: [result.data.dataset],
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
        queryKey: queryKeys.donutChart(additionalParams),
        queryFn: fetchDonutChartData,
    });

    if (isLoading) {
        return <LoadingCard />;
    }

    if (isError) {
        return <ErrorCard />;
    }

    if (!chartData?.labels?.length) {
        return <EmptyCard />;
    }

    return (
        <Card>
            <CardHeader
                title="Expenses By Category"
                slotProps={{
                    title: {
                        fontSize: '1.25rem',
                    },
                }}
                sx={{ mb: 0, pb: 0 }}
            />

            <CardContent sx={{ height: 500 }}>
                <Doughnut data={chartData} options={options} />
            </CardContent>
        </Card>
    );
}
