import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import type { ChartOptions } from 'chart.js';
import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from 'chart.js';
import DetailRow from 'components/DetailRow';
import useMetricContext from 'hooks/useMetricContext';
import { useEffect, useEffectEvent, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const axisColor = '#E0E0E0';
const gridColor = 'rgba(255, 255, 255, 0.1)';

/**
 * ChartJS Options - query count on the left axis, avg ms on the right
 */
const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    color: axisColor,
    interaction: { mode: 'index', intersect: false },
    scales: {
        x: {
            ticks: { color: axisColor },
            grid: { color: gridColor },
            border: { color: axisColor },
        },
        y: {
            position: 'left',
            title: { display: true, text: 'Queries', color: axisColor },
            ticks: { color: axisColor, precision: 0 },
            grid: { color: gridColor },
            border: { color: axisColor },
            beginAtZero: true,
        },
        ms: {
            position: 'right',
            title: { display: true, text: 'Avg ms', color: axisColor },
            ticks: { color: axisColor },
            grid: { drawOnChartArea: false },
            border: { color: axisColor },
            beginAtZero: true,
        },
    },
    plugins: {
        legend: { labels: { color: axisColor } },
        title: { color: axisColor },
    },
    backgroundColor: 'transparent',
    devicePixelRatio: window.devicePixelRatio || 2,
};

const MAX_POINTS = 30;

interface QuerySample {
    count: number;
    avgMs: number;
    label: string;
}

/**
 * Live database query throughput and latency, sampled every metrics push
 */
export default function QueryMetrics() {
    const { metrics } = useMetricContext();
    const theme = useTheme();

    const [history, setHistory] = useState<QuerySample[]>([]);

    /**
     * setState calls are allowed in useEffectEvent
     * This listens for when metrics is updated and will update the state used here
     */
    const updateChartData = useEffectEvent((count: number, avgMs: number) => {
        // eslint-disable-next-line @eslint-react/set-state-in-effect -- appends each pushed metrics sample; history is external stream data, not derived state
        setHistory((prev) => [...prev.slice(-MAX_POINTS), { count, avgMs, label: new Date().toLocaleTimeString() }]);
    });

    useEffect(() => {
        if (!metrics) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- records each metrics update from the socket into chart history
        updateChartData(metrics.queries.count, metrics.queries.avgMs);
    }, [metrics]);

    const chartData = useMemo(
        () => ({
            labels: history.map((s) => s.label),
            datasets: [
                {
                    label: 'Queries',
                    data: history.map((s) => s.count),
                    yAxisID: 'y',
                    tension: 0.3,
                    fill: false,
                    borderColor: theme.palette.primary.main,
                    backgroundColor: theme.palette.primary.main,
                },
                {
                    label: 'Avg ms',
                    data: history.map((s) => s.avgMs),
                    yAxisID: 'ms',
                    tension: 0.3,
                    fill: false,
                    borderColor: theme.palette.warning.main,
                    backgroundColor: theme.palette.warning.main,
                },
            ],
        }),
        [history, theme.palette.primary.main, theme.palette.warning.main]
    );

    if (!metrics || !history.length) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    const { queries } = metrics;

    return (
        <Card>
            <CardHeader title="Query Metrics" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent>
                <Stack spacing={2}>
                    <Box sx={{ minHeight: 400 }}>
                        <Line data={chartData} options={options} />
                    </Box>

                    <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                        <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: 'wrap' }}>
                            <DetailRow label="Current" value={queries.count} />
                            <DetailRow label="Peak" value={queries.peak} />
                            <DetailRow label="Avg" value={`${String(queries.avgMs)}ms`} />
                            <DetailRow label="Max" value={`${String(queries.maxMs)}ms`} />
                            <DetailRow label="Errors" value={queries.errors} />
                            <DetailRow label="Total" value={queries.total.toLocaleString()} />
                        </Stack>
                    </Paper>
                </Stack>
            </CardContent>
        </Card>
    );
}
