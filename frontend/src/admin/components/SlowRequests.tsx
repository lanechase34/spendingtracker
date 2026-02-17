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
import useMetricContext from 'hooks/useMetricContext';
import type { SlowRequest } from 'types/MetricResponse.type';

export default function SlowRequests() {
    const { metrics } = useMetricContext();

    if (!metrics) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    return (
        <Card>
            <CardHeader title="Slow Running Requests" sx={{ pb: 1 }} slotProps={{ title: { variant: 'h6' } }} />

            <Divider />

            <CardContent>
                <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: 60 }}>
                        <TableHead>
                            <TableRow>
                                <TableCell>URL</TableCell>
                                <TableCell>Method</TableCell>
                                <TableCell align="right">ms</TableCell>
                                <TableCell>User</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {metrics?.concurrency.slowRequests.map((r: SlowRequest) => (
                                <TableRow key={`slow_request_${r.uuid}`}>
                                    <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                        {r.urlpath}
                                    </TableCell>
                                    <TableCell>{r.method}</TableCell>
                                    <TableCell align="right">{r.delta}</TableCell>
                                    <TableCell>{r.userid}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>
            </CardContent>
        </Card>
    );
}
