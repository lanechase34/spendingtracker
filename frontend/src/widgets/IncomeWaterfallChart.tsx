import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import type { ChartData, ChartOptions } from 'chart.js';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import EmptyCard from 'components/EmptyCard';
import ErrorCard from 'components/ErrorCard';
import LoadingCard from 'components/LoadingCard';
import useAuthFetch from 'hooks/useAuthFetch';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import type { IncomeWaterfallChart } from 'types/IncomeWaterfallChart.type';
import { IncomeWaterfallChartResponseSchema } from 'types/IncomeWaterfallChart.type';
import { linePlugins } from 'utils/chartPlugins';
import { API_BASE_URL } from 'utils/constants';
import { queryKeys } from 'utils/queryKeys';
import { safeJson } from 'utils/safeJson';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, annotationPlugin);

/**
 * Waterfall chart showing monthly net income (income - expenses).
 * Each bar floats from the previous month's running total, so the chart
 * shows both each month's change and the overall position over time.
 */
export default function IncomeWaterfallChart() {
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
     * Fetch function for TanStack Query - returns the raw response so we
     * can transform into floating-bar pairs inside a useMemo below.
     */
    const fetchWaterfallData = async ({ signal }: { signal: AbortSignal }): Promise<IncomeWaterfallChart> => {
        const urlParams = new URLSearchParams(additionalParams);
        const response = await authFetch({
            url: `${API_BASE_URL}/widgets/incomeWaterfall?${urlParams.toString()}`,
            method: 'GET',
            signal: signal,
        });

        if (!response) throw new Error('No response');
        if (!response.ok) throw new Error('Invalid network response');

        const json = await safeJson(response);
        const parsed = IncomeWaterfallChartResponseSchema.safeParse(json);

        if (!parsed.success || parsed.data.error) throw new Error('Bad Request');

        return parsed.data.data;
    };

    /**
     * TanStack Query hook - automatically handles loading, error, caching, and refetching
     */
    const {
        data: rawData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: queryKeys.incomeWaterfallChart(additionalParams),
        queryFn: fetchWaterfallData,
    });

    /**
     * Build the chart data by converting each value into a [start, end] pair
     * where start = previous running total and end = new running total
     */
    const chartData: ChartData<'bar'> | null = useMemo(() => {
        if (!rawData?.values?.length) return null;

        let running = 0;
        const floatingBars: [number, number][] = rawData.values.map((v) => {
            const start = running;
            running += v;
            return [start, running];
        });

        // Color each bar by the sign of its delta
        const backgroundColors = rawData.values.map((v) =>
            v >= 0 ? theme.palette.success.main : theme.palette.error.main
        );

        return {
            labels: rawData.labels,
            datasets: [
                {
                    label: 'Net Change',
                    data: floatingBars as unknown as number[],
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors,
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        };
    }, [rawData, theme]);

    /**
     * Y-axis bounds padded by 15% of the data range (leaves room for data label)
     */
    const yAxisBounds = useMemo(() => {
        if (!rawData?.values?.length) return { min: undefined, max: undefined };

        let running = 0;
        let min = 0;
        let max = 0;
        rawData.values.forEach((v) => {
            running += v;
            if (running < min) min = running;
            if (running > max) max = running;
        });

        const padding = (max - min) * 0.05;
        return { min: min - padding, max: max + padding };
    }, [rawData]);

    /**
     * ChartJS options
     */
    const options: ChartOptions<'bar'> = useMemo(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    right: 15,
                    top: 15,
                },
            },
            color: '#E0E0E0',
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
                            return '$' + Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
                        },
                    },
                    grid: {
                        // Emphasize the zero line - it's the divide between gains and losses
                        color: (ctx) =>
                            ctx.tick.value === 0 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                        lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1),
                    },
                    border: { color: '#E0E0E0' },
                    // Pad min/max y values for data labels
                    suggestedMin: yAxisBounds.min,
                    suggestedMax: yAxisBounds.max,
                },
            },
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: false,
                },
                tooltip: {
                    ...linePlugins.tooltip,
                    enabled: true,
                    callbacks: {
                        label: (ctx) => {
                            const idx = ctx.dataIndex;
                            const delta = rawData?.values[idx] ?? 0;
                            const [, end] = ctx.raw as [number, number];
                            const sign = delta >= 0 ? '+' : '-';
                            const deltaStr = Math.abs(delta).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            });
                            const totalSign = end >= 0 ? '+' : '-';
                            const totalStr = Math.abs(end).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            });
                            return [`Change: ${sign}$${deltaStr}`, `Running: ${totalSign}$${totalStr}`];
                        },
                    },
                },
                datalabels: {
                    ...linePlugins.datalabels,
                    display: (ctx) => {
                        const v = rawData?.values[ctx.dataIndex] ?? 0;
                        return v !== 0;
                    },
                    // Show the delta above/below each bar depending on direction
                    align: (ctx) => {
                        const v = rawData?.values[ctx.dataIndex] ?? 0;
                        return v >= 0 ? 'end' : 'start';
                    },
                    anchor: (ctx) => {
                        const v = rawData?.values[ctx.dataIndex] ?? 0;
                        return v >= 0 ? 'end' : 'start';
                    },

                    formatter: (_value, ctx) => {
                        const delta = rawData?.values[ctx.dataIndex] ?? 0;
                        const sign = delta >= 0 ? '+' : '-';
                        return (
                            sign +
                            '$' +
                            Math.abs(delta).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })
                        );
                    },
                },
            },
            backgroundColor: 'transparent',
            devicePixelRatio: window.devicePixelRatio || 2,
        }),
        [rawData, yAxisBounds]
    );

    if (isLoading) {
        return <LoadingCard />;
    }

    if (isError) {
        return <ErrorCard />;
    }

    if (!chartData) {
        return <EmptyCard />;
    }

    return (
        <Card>
            <CardHeader
                title="Net Income By Month"
                slotProps={{
                    title: {
                        sx: { fontSize: { xs: '1rem', sm: '1.25rem' } },
                    },
                }}
                sx={{ mb: 0, pb: 0 }}
            />

            <CardContent sx={{ height: 500 }}>
                <Bar key="incomeWaterfallChart" data={chartData} options={options} plugins={[ChartDataLabels]} />
            </CardContent>
        </Card>
    );
}
