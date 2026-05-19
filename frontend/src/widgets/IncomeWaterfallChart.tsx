import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import type { ChartData, ChartOptions } from 'chart.js';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import type { AnnotationOptions } from 'chartjs-plugin-annotation';
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
 *
 * Each bar is stacked into two segments:
 *   - Spendable Net: net income minus the portion set aside as savings
 *   - Savings: the portion of net income transferred to savings
 */
export default function IncomeWaterfallChart() {
    const { formattedStartDate, formattedEndDate } = useDateRangeContext();
    const authFetch = useAuthFetch();
    const theme = useTheme();

    const successColor = theme.palette.success.main;
    const errorColor = theme.palette.error.main;
    const infoColor = theme.palette.info.main;

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

        if (!parsed.success) {
            console.error('IncomeWaterfallChart schema mismatch', parsed.error);
            throw new Error('Bad Request');
        }

        if (parsed.data.error) throw new Error('Bad Request');

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
     * Build the stacked floating-bar data.
     */
    const chartData: ChartData<'bar'> | null = useMemo(() => {
        if (!rawData?.segments?.length) return null;

        // Each bar is the full [start, end] range; we'll draw savings as an overlay below
        const ranges: [number, number][] = rawData.segments.map((s) => {
            const start = s.runningTotal - s.net;
            const end = s.runningTotal;
            return [start, end];
        });

        const colors = rawData.segments.map((s) => (s.net >= 0 ? successColor : errorColor));

        return {
            labels: rawData.labels,
            datasets: [
                {
                    label: 'Net Change',
                    data: ranges as unknown as number[],
                    backgroundColor: colors,
                    borderColor: colors,
                    borderWidth: 0,
                    borderRadius: 0,
                },
            ],
        };
    }, [rawData, successColor, errorColor]);

    const savingsAnnotations = useMemo(() => {
        if (!rawData?.segments?.length) return {};

        const annotations: Record<string, AnnotationOptions> = {};
        rawData.segments.forEach((segment, idx) => {
            if (segment.net <= 0 || segment.savings <= 0) return;

            const end = segment.runningTotal;
            const savingsBottom = Math.max(end - segment.savings, segment.runningTotal - segment.net);

            annotations[`savings_${idx}`] = {
                type: 'box',
                xMin: idx - 0.355,
                xMax: idx + 0.355,
                yMin: savingsBottom,
                yMax: end,
                backgroundColor: infoColor,
                borderColor: infoColor,
                borderWidth: 0,
                borderRadius: 0,
            };
        });

        return annotations;
    }, [rawData, infoColor]);

    /**
     * Y-axis bounds padded by 5% of the running-total range
     */
    const yAxisBounds = useMemo(() => {
        if (!rawData?.segments?.length) return { min: undefined, max: undefined };

        let min = 0;
        let max = 0;
        rawData.segments.forEach((segment) => {
            if (segment.runningTotal < min) min = segment.runningTotal;
            if (segment.runningTotal > max) max = segment.runningTotal;
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
            interaction: {
                mode: 'index',
                intersect: false,
            },
            layout: {
                ...linePlugins.layout,
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
                    mode: 'index',
                    intersect: false,
                    displayColors: false,
                    callbacks: {
                        // One tooltip body per dataset hovered, but we want the same
                        // summary regardless of which segment the user is over
                        label: (ctx) => {
                            const segment = rawData?.segments[ctx.dataIndex];
                            if (!segment) return '';

                            const fmt = (n: number) =>
                                n.toLocaleString(undefined, {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                });

                            const netSign = segment.net >= 0 ? '+' : '-';
                            const totalSign = segment.runningTotal >= 0 ? '+' : '-';

                            return [
                                `Net: ${netSign}$${fmt(Math.abs(segment.net))}`,
                                `Of which savings: $${fmt(segment.savings)}`,
                                `Running: ${totalSign}$${fmt(Math.abs(segment.runningTotal))}`,
                            ];
                        },
                    },
                },
                datalabels: {
                    ...linePlugins.datalabels,
                    display: (ctx) => (rawData?.segments[ctx.dataIndex]?.net ?? 0) !== 0,
                    align: (ctx) => ((rawData?.segments[ctx.dataIndex]?.net ?? 0) >= 0 ? 'end' : 'start'),
                    anchor: (ctx) => ((rawData?.segments[ctx.dataIndex]?.net ?? 0) >= 0 ? 'end' : 'start'),
                    formatter: (_value, ctx) => {
                        const segment = rawData?.segments[ctx.dataIndex];
                        if (!segment) return '';
                        const sign = segment.net >= 0 ? '+' : '-';
                        return (
                            sign +
                            '$' +
                            Math.abs(segment.net).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })
                        );
                    },
                },
                annotation: {
                    annotations: savingsAnnotations,
                },
            },
            backgroundColor: 'transparent',
            devicePixelRatio: window.devicePixelRatio || 2,
        }),
        [rawData, yAxisBounds, savingsAnnotations]
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
                subheader={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <InfoOutlinedIcon fontSize="inherit" />
                        <span>Includes net income + savings</span>
                    </Box>
                }
                slotProps={{
                    title: {
                        sx: { fontSize: { xs: '1rem', sm: '1.25rem' } },
                    },
                    subheader: {
                        sx: { fontSize: { xs: '0.75rem', sm: '0.875rem' } },
                    },
                }}
                sx={{ mb: 0, pb: 0 }}
            />

            <CardContent sx={{ height: 500 }}>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: 2,
                        mb: 1,
                        color: '#E0E0E0',
                        fontSize: '0.875rem',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                            sx={{
                                width: 30,
                                height: 12,
                                background: `linear-gradient(to right, ${successColor} 50%, ${errorColor} 50%)`,
                                borderRadius: 0.5,
                            }}
                        />
                        <span>Net Change</span>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box
                            sx={{
                                width: 30,
                                height: 12,
                                backgroundColor: infoColor,
                                borderRadius: 0.5,
                            }}
                        />
                        <span>Savings</span>
                    </Box>
                </Box>

                <Box sx={{ height: 'calc(100% - 28px)' }}>
                    <Bar key="incomeWaterfallChart" data={chartData} options={options} plugins={[ChartDataLabels]} />
                </Box>
            </CardContent>
        </Card>
    );
}
