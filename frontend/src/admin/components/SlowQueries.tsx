import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import dayjs from 'dayjs';
import useMetricContext from 'hooks/useMetricContext';
import type { SlowQuery } from 'types/MetricResponse.type';
import { TIMESTAMP_FORMAT } from 'utils/timeFormatter';

export default function SlowQueries() {
    const { metrics } = useMetricContext();

    if (!metrics) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    return (
        <Card>
            <CardHeader title="Slow Running Queries" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent>
                <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 60 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>SQL</TableCell>
                                <TableCell align="right">ms</TableCell>
                                <TableCell>Timestamp</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {metrics.queries.slowQueries.map((q: SlowQuery) => (
                                <TableRow key={`slow_query_${q.uuid}`}>
                                    <TableCell
                                        sx={{ whiteSpace: 'normal', wordBreak: 'break-word', fontFamily: 'monospace' }}
                                    >
                                        {q.sql}
                                    </TableCell>
                                    <TableCell align="right">{q.ms}</TableCell>
                                    <TableCell>{dayjs(q.time).format(TIMESTAMP_FORMAT)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            </CardContent>
        </Card>
    );
}
