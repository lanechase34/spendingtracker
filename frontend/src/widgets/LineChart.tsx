import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import useDateRangeContext from 'hooks/useDateRangeContext';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import type { ChartData, ChartDataset, ChartOptions } from 'chart.js';
import LoadingCard from 'components/LoadingCard';
import ErrorCard from 'components/ErrorCard';
import EmptyCard from 'components/EmptyCard';
import useAuthFetch from 'hooks/useAuthFetch';
import { queryKeys } from 'utils/queryKeys';
import CardHeader from '@mui/material/CardHeader';
import { useTheme } from '@mui/material/styles';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import annotationPlugin from 'chartjs-plugin-annotation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, annotationPlugin);

interface LineChartResponse {
    data: {
        labels: string[];
        dataset: ChartDataset<'line'>;
    };
    error?: boolean;
}

/**
 * Line chart showing monthly expense trends
 */
export default function LineChart() {
    const { formattedStartDate, formattedEndDate } = useDateRangeContext();
    const authFetch = useAuthFetch();
    const theme = useTheme();

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
    const fetchLineChartData = async ({ signal }: { signal: AbortSignal }): Promise<ChartData<'line'>> => {
        const urlParams = new URLSearchParams(additionalParams);
        const response = await authFetch({
            url: `/spendingtracker/api/v1/widgets/lineChart?${urlParams.toString()}`,
            method: 'GET',
            signal: signal,
        });

        if (!response) throw new Error('No response');
        if (!response.ok) throw new Error('Invalid network response');

        const result = (await response.json()) as LineChartResponse;
        if (result?.error ?? false) throw new Error('Bad Request');

        return {
            labels: result.data.labels,
            datasets: [
                {
                    ...result.data.dataset,
                    borderColor: theme.palette.primary.main,
                    backgroundColor: theme.palette.primary.main,
                    tension: 0.3,
                    borderWidth: 3,
                    pointRadius: 2,
                },
            ],
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
        queryKey: queryKeys.expenseLineChart(additionalParams),
        queryFn: fetchLineChartData,
    });

    /**
     * Calculate average value, returns null if dataset empty
     */
    const averageValue = useMemo(() => {
        if (!chartData?.datasets?.[0]?.data) return null;
        const data = chartData.datasets[0].data as number[];
        if (data.length === 0) return null;

        const sum = data.reduce((acc, val) => acc + val, 0);
        return sum / data.length;
    }, [chartData]);

    /**
     * ChartJS options
     */
    const options: ChartOptions<'line'> = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            color: '#E0E0E0',
            layout: {
                padding: {
                    right: 40,
                },
            },
            scales: {
                x: {
                    ticks: { color: '#E0E0E0' },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    },
                    border: { color: '#E0E0E0' },
                },
                y: {
                    ticks: {
                        color: '#E0E0E0',
                        precision: 0,
                        callback: (value) => {
                            return '$' + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
                        },
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)',
                    },
                    border: { color: '#E0E0E0' },
                    beginAtZero: true,
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: false,
                },
                tooltip: { enabled: false },
                datalabels: {
                    align: 'top',
                    anchor: 'end',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    borderColor: '#666',
                    borderWidth: 1,
                    borderRadius: 4,
                    padding: 6,
                    color: '#fff',
                    font: {
                        size: 11,
                        weight: 'bold',
                    },
                    formatter: (value: number) => {
                        return (
                            '$' +
                            value.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })
                        );
                    },
                },
                annotation: {
                    annotations:
                        averageValue !== null
                            ? {
                                  averageLine: {
                                      type: 'line',
                                      yMin: averageValue,
                                      yMax: averageValue,
                                      borderColor: theme.palette.warning.main,
                                      borderWidth: 2,
                                      borderDash: [5, 5],
                                      label: {
                                          content: `Avg: $${averageValue.toLocaleString(undefined, {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                          })}`,
                                          position: 'end',
                                          display: true,
                                          padding: 4,
                                          backgroundColor: theme.palette.warning.main,
                                          color: theme.palette.warning.contrastText,
                                      },
                                  },
                              }
                            : {},
                },
            },
            backgroundColor: 'transparent',
            devicePixelRatio: window.devicePixelRatio || 2,
        }),
        [theme, averageValue]
    );

    if (isLoading) {
        return <LoadingCard />;
    }

    if (isError) {
        return <ErrorCard />;
    }

    if (!chartData?.datasets[0]?.data?.length) {
        return <EmptyCard />;
    }

    return (
        <Card>
            <CardHeader
                title="Expenses By Month"
                slotProps={{
                    title: {
                        fontSize: '1.25rem',
                    },
                }}
                sx={{ mb: 0, pb: 0 }}
            />

            <CardContent sx={{ height: 500 }}>
                <Line key="expenseLineChart" data={chartData} options={options} plugins={[ChartDataLabels]} />
            </CardContent>
        </Card>
    );
}
