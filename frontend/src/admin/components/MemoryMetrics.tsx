import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import { useTheme } from '@mui/material/styles';
import type { ChartData, ChartOptions } from 'chart.js';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import useMetricContext from 'hooks/useMetricContext';
import { useEffect, useEffectEvent, useState } from 'react';
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

    const [chartData, setChartData] = useState<ChartData<'doughnut'>>({
        labels: ['Used', 'Free', 'Max (Unallocated)'],
        datasets: [],
    });

    /**
     * setState calls are allowed in useEffectEvent
     * This listens for when metrics is updated and will update the state used here
     */
    const updateChartData = useEffectEvent((used: number, free: number, max: number) => {
        setChartData((prev) => ({
            ...prev,
            datasets: [
                {
                    label: 'JVM Memory (MB)',
                    data: [used, free, max],
                    backgroundColor: [
                        theme.palette.success.main, // Used
                        theme.palette.warning.main, // Free
                        theme.palette.grey[800], // Unallocated
                    ],
                    hoverOffset: 4,
                    borderWidth: 0,
                },
            ],
        }));
    });

    useEffect(() => {
        if (!metrics) return;

        const used = metrics.memory.usedMB;
        const allocated = metrics.memory.totalMB;
        const max = metrics.memory.maxMB;

        const free = allocated - used;
        const unallocated = max - allocated;

        updateChartData(used, free, unallocated);
    }, [metrics]);

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
