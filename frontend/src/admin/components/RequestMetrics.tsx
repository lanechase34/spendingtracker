import { useState, useEffect, useMemo, useEffectEvent } from 'react';
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
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { Line } from 'react-chartjs-2';
import Box from '@mui/material/Box';
import DetailRow from 'components/DetailRow';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import type { ChartOptions } from 'chart.js';
import { useTheme } from '@mui/material/styles';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import useMetricContext from 'hooks/useMetricContext';
import Skeleton from '@mui/material/Skeleton';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

/**
 * ChartJS Options
 */
const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
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
            ticks: { color: '#E0E0E0', precision: 0 },
            grid: {
                color: 'rgba(255, 255, 255, 0.1)',
            },
            border: { color: '#E0E0E0' },
            beginAtZero: true,
        },
    },
    plugins: {
        legend: {
            labels: {
                color: '#E0E0E0',
            },
        },
        title: {
            color: '#E0E0E0',
        },
    },
    backgroundColor: 'transparent',
    devicePixelRatio: window.devicePixelRatio || 2,
};

const MAX_POINTS = 30;

export default function RequestMetrics() {
    const { metrics } = useMetricContext();
    const theme = useTheme();

    const [history, setHistory] = useState<number[]>([]);
    const [labels, setLabels] = useState<string[]>([]);

    /**
     * setState calls are allowed in useEffectEvent
     * This listens for when metrics is updated and will update the state used here
     */
    const updateChartData = useEffectEvent((activeRequests: number) => {
        setHistory((prev) => [...prev.slice(-MAX_POINTS), activeRequests]);
        setLabels((prev) => [...prev.slice(-MAX_POINTS), new Date().toLocaleTimeString()]);
    });

    useEffect(() => {
        if (!metrics) return;
        updateChartData(metrics.concurrency.activeRequests);
    }, [metrics]);

    const chartData = useMemo(
        () => ({
            labels,
            datasets: [
                {
                    label: 'Active',
                    data: history,
                    tension: 0.3,
                    fill: false,
                    borderColor: theme.palette.primary.main,
                    backgroundColor: theme.palette.primary.main,
                },
            ],
        }),
        [labels, history, theme.palette.primary.main]
    );

    if (!metrics || !history.length) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    return (
        <Card>
            <CardHeader title="Request Metrics" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent>
                <Stack spacing={2}>
                    <Box sx={{ minHeight: 400 }}>
                        <Line data={chartData} options={options} />
                    </Box>

                    <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                        <Stack spacing={2}>
                            <DetailRow label="Current" value={metrics?.concurrency.activeRequests} />

                            <DetailRow label="Peak" value={metrics?.concurrency.maxRequests} />
                        </Stack>
                    </Paper>
                </Stack>
            </CardContent>
        </Card>
    );
}
