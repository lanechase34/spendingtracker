import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import DetailRow from 'components/DetailRow';
import useMetricContext from 'hooks/useMetricContext';
import { useMemo } from 'react';

/**
 * Requests blocked by the rate limiter - current window, since startup, and per event
 */
export default function RateLimitMetrics() {
    const { metrics } = useMetricContext();

    const byEvent = useMemo(
        () => Object.entries(metrics?.rateLimit.byEvent ?? {}).sort(([, a], [, b]) => b - a),
        [metrics?.rateLimit.byEvent]
    );

    if (!metrics) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    return (
        <Card>
            <CardHeader title="Rate Limit Blocks" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent>
                <Stack spacing={2}>
                    <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                        <Stack direction="row" spacing={4}>
                            <DetailRow label="Current" value={metrics.rateLimit.blocked} />

                            <DetailRow label="Since Startup" value={metrics.rateLimit.total} />
                        </Stack>
                    </Paper>

                    {byEvent.length > 0 && (
                        <Box sx={{ width: '100%', overflowX: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Event</TableCell>
                                        <TableCell align="right">Blocked</TableCell>
                                    </TableRow>
                                </TableHead>

                                <TableBody>
                                    {byEvent.map(([event, count]) => (
                                        <TableRow key={`rate_limit_${event}`}>
                                            <TableCell>{event}</TableCell>
                                            <TableCell align="right">{count}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}
