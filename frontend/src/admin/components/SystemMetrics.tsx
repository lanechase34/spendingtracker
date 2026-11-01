import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import DetailRow from 'components/DetailRow';
import useMetricContext from 'hooks/useMetricContext';
import { formatUptime } from 'utils/timeFormatter';

/**
 * Format a nullable percentage
 */
const percent = (value: number | null | undefined) => (value == null ? 'N/A' : `${String(value)}%`);

export default function SystemMetrics() {
    const { metrics } = useMetricContext();

    if (!metrics) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    return (
        <Card>
            <CardHeader title="System Information" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent>
                <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                    <Stack spacing={2}>
                        <DetailRow label="Uptime" value={formatUptime(metrics.uptimeMs)} />

                        <DetailRow label="Cores" value={metrics.cpu.cores} />

                        <DetailRow label="CPU Process Percentage" value={percent(metrics.cpu.processPercent)} />

                        <DetailRow label="CPU System Percentage" value={percent(metrics.cpu.systemPercent)} />

                        <DetailRow
                            label="Threads (Live / Peak / Daemon)"
                            value={`${String(metrics.threads.live)} / ${String(metrics.threads.peak)} / ${String(metrics.threads.daemon)}`}
                        />

                        <DetailRow
                            label="Deadlocked Threads"
                            value={
                                <Chip
                                    label={metrics.threads.deadlocked}
                                    size="small"
                                    color={metrics.threads.deadlocked > 0 ? 'error' : 'default'}
                                />
                            }
                        />

                        <DetailRow
                            label="GC Time (Last Window)"
                            value={`${String(metrics.gc.deltaMs)}ms (${String(metrics.gc.percent)}%)`}
                        />
                    </Stack>
                </Paper>
            </CardContent>
        </Card>
    );
}
