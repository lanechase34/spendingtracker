import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import type { ChartData, ChartOptions } from 'chart.js';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import useMetricContext from 'hooks/useMetricContext';
import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { donutPlugins, pointerHover } from 'utils/chartPlugins';

ChartJS.register(ArcElement, Tooltip, Legend);

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
            },
        },
        tooltip: {
            ...donutPlugins.tooltip,
            callbacks: { label: donutPlugins.labels.memory },
        },
    },
    cutout: `50%`,
    onHover: pointerHover,
    maintainAspectRatio: false,
    devicePixelRatio: window.devicePixelRatio || 2,
};

export default function MemoryMetrics() {
    const { metrics } = useMetricContext();
    const theme = useTheme();

    const chartData = useMemo<ChartData<'doughnut'>>(() => {
        if (!metrics) {
            return { labels: ['Used', 'Free', 'Max (Unallocated)'], datasets: [] };
        }

        const used = metrics.memory.usedMB;
        const allocated = metrics.memory.totalMB;
        const max = metrics.memory.maxMB;
        const free = allocated - used;
        const unallocated = max - allocated;

        return {
            labels: ['Used', 'Free', 'Max (Unallocated)'],
            datasets: [
                {
                    label: 'JVM Memory (MB)',
                    data: [used, free, unallocated],
                    backgroundColor: [theme.palette.success.main, theme.palette.warning.main, theme.palette.grey[800]],
                    hoverOffset: 4,
                    borderWidth: 0,
                },
            ],
        };
    }, [metrics, theme]);

    if (!metrics || !chartData.datasets.length) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    return (
        <Card>
            <CardHeader title="JVM Memory Usage" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: 300,
                    m: 1,
                }}
            >
                <Doughnut data={chartData} options={options} />
            </CardContent>
        </Card>
    );
}
