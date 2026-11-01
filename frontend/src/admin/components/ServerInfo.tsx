import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DetailRow from 'components/DetailRow';
import ErrorCard from 'components/ErrorCard';
import dayjs from 'dayjs';
import useDiagnosticsQuery from 'hooks/useDiagnosticsQuery';
import type { DiskStat } from 'types/DiagnosticsResponse.type';
import { TIMESTAMP_FORMAT } from 'utils/timeFormatter';

const DISK_WARNING_PERCENT = 80;
const DISK_ERROR_PERCENT = 90;

/**
 * Format megabytes as GB once large enough
 */
const formatMB = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${String(mb)} MB`);

/**
 * Disk usage bar for a single volume
 */
function DiskUsage({ disk }: { disk: DiskStat }) {
    const color =
        disk.usedPercent >= DISK_ERROR_PERCENT
            ? 'error'
            : disk.usedPercent >= DISK_WARNING_PERCENT
              ? 'warning'
              : 'success';

    return (
        <Stack spacing={0.5}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {disk.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatMB(disk.freeMB)} free of {formatMB(disk.totalMB)}
                </Typography>
            </Stack>
            <LinearProgress
                variant="determinate"
                value={disk.usedPercent}
                color={color}
                sx={{ height: 8, borderRadius: 1 }}
            />
            <Typography variant="caption" sx={{ color: 'text.disabled', wordBreak: 'break-all' }}>
                {disk.path}
            </Typography>
        </Stack>
    );
}

/**
 * Static app/runtime information and disk space
 */
export default function ServerInfo() {
    const { data, isLoading, isError } = useDiagnosticsQuery();

    if (isError) {
        return <ErrorCard errorMessage="Unable to load server info." />;
    }

    if (isLoading || !data) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    const { app, disk } = data;

    return (
        <Card>
            <CardHeader title="Server Info" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent>
                <Stack spacing={2}>
                    <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                        <Stack spacing={2}>
                            <DetailRow label="Application" value={`${app.name} v${app.version} (${app.environment})`} />

                            <DetailRow label="Started" value={dayjs(app.startedAt).format(TIMESTAMP_FORMAT)} />

                            <DetailRow label="Lucee" value={app.lucee} />

                            <DetailRow label="Java" value={app.java} />

                            <DetailRow label="OS" value={app.os} />

                            <DetailRow label="Timezone" value={app.timezone} />
                        </Stack>
                    </Paper>

                    <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle2">Disk Space</Typography>
                            {disk.map((d) => (
                                <Box key={`disk_${d.name}`}>
                                    <DiskUsage disk={d} />
                                </Box>
                            ))}
                        </Stack>
                    </Paper>
                </Stack>
            </CardContent>
        </Card>
    );
}
