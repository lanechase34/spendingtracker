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

/**
 * Live database health - connectivity, latency and connection states from pg_stat_activity
 */
export default function DatabaseMetrics() {
    const { metrics } = useMetricContext();

    if (!metrics) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    const { database } = metrics;
    const conn = database.connections;

    return (
        <Card>
            <CardHeader
                title="Database"
                sx={{ pb: 1 }}
                slotProps={{ title: { variant: 'h6' } }}
                action={
                    <Chip
                        label={database.up ? 'Up' : 'Down'}
                        color={database.up ? 'success' : 'error'}
                        size="small"
                        sx={{ mt: 1, mr: 1 }}
                    />
                }
            />

            <Divider />

            <CardContent>
                <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                    <Stack spacing={2}>
                        <DetailRow
                            label="Ping"
                            value={database.pingMs == null ? 'N/A' : `${String(database.pingMs)}ms`}
                        />

                        <DetailRow
                            label="Connections"
                            value={conn ? `${String(conn.total)} / ${String(conn.max)}` : 'N/A'}
                        />

                        {conn && (
                            <>
                                <DetailRow label="Active" value={conn.active} />

                                <DetailRow label="Idle" value={conn.idle} />

                                <DetailRow
                                    label="Idle In Transaction"
                                    value={
                                        <Chip
                                            label={conn.idleInTransaction}
                                            size="small"
                                            color={conn.idleInTransaction > 0 ? 'warning' : 'default'}
                                        />
                                    }
                                />

                                <DetailRow
                                    label="Waiting On Lock"
                                    value={
                                        <Chip
                                            label={conn.waitingOnLock}
                                            size="small"
                                            color={conn.waitingOnLock > 0 ? 'error' : 'default'}
                                        />
                                    }
                                />
                            </>
                        )}

                        <DetailRow label="Longest Running Query" value={`${String(database.longestQuerySeconds)}s`} />
                    </Stack>
                </Paper>
            </CardContent>
        </Card>
    );
}
