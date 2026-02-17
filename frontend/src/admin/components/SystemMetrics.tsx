import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import DetailRow from 'components/DetailRow';
import useMetricContext from 'hooks/useMetricContext';

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
                        <DetailRow label="Cores" value={metrics?.cpu.cores} />

                        <DetailRow label="CPU Process Percentage" value={`${metrics?.cpu.processPercent}%`} />

                        <DetailRow label="CPU System Percentage" value={`${metrics?.cpu.systemPercent}%`} />
                    </Stack>
                </Paper>
            </CardContent>
        </Card>
    );
}
