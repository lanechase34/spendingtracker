import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import DetailRow from 'components/DetailRow';
import ErrorCard from 'components/ErrorCard';
import dayjs from 'dayjs';
import useDiagnosticsQuery from 'hooks/useDiagnosticsQuery';
import { TIMESTAMP_FORMAT } from 'utils/timeFormatter';

// Below this the working set doesn't fit in shared_buffers
const CACHE_HIT_WARNING = 99;

// Dead rows above this share of live rows suggest autovacuum is falling behind
const DEAD_ROW_WARNING_RATIO = 0.2;

const formatDate = (value: string | null | undefined) =>
    value != null && value !== '' ? dayjs(value).format(TIMESTAMP_FORMAT) : 'Never';

/**
 * Postgres internals - totals since the last stats reset, table health, and top statements
 */
export default function DatabaseDiagnostics() {
    const { data, isLoading, isError } = useDiagnosticsQuery();

    if (isError) {
        return <ErrorCard errorMessage="Unable to load database diagnostics." />;
    }

    if (isLoading || !data) {
        return <Skeleton variant="rectangular" height={300} />;
    }

    const { database } = data;

    return (
        <Card>
            <CardHeader
                title="Database Diagnostics"
                subheader={database.available ? `PostgreSQL ${database.version}` : undefined}
                sx={{ pb: 1 }}
                slotProps={{ title: { variant: 'h6' } }}
            />

            <Divider />

            <CardContent>
                {!database.available || !database.stats ? (
                    <Alert severity="error">Database diagnostics are unavailable. Check the admin log.</Alert>
                ) : (
                    <Stack spacing={3}>
                        <Paper elevation={0} sx={{ p: 3, flex: 1 }}>
                            <Stack direction="row" spacing={4} useFlexGap sx={{ flexWrap: 'wrap' }}>
                                <DetailRow label="Size" value={`${String(database.sizeMB)} MB`} />

                                <DetailRow
                                    label="Cache Hit Ratio"
                                    value={
                                        <Chip
                                            label={`${String(database.stats.cacheHitRatio)}%`}
                                            size="small"
                                            color={
                                                database.stats.cacheHitRatio < CACHE_HIT_WARNING ? 'warning' : 'success'
                                            }
                                        />
                                    }
                                />

                                <DetailRow label="Commits" value={database.stats.commits.toLocaleString()} />

                                <DetailRow label="Rollbacks" value={database.stats.rollbacks.toLocaleString()} />

                                <DetailRow
                                    label="Deadlocks"
                                    value={
                                        <Chip
                                            label={database.stats.deadlocks}
                                            size="small"
                                            color={database.stats.deadlocks > 0 ? 'error' : 'default'}
                                        />
                                    }
                                />

                                <DetailRow
                                    label="Temp Files"
                                    value={`${String(database.stats.tempFiles)} (${String(database.stats.tempMB)} MB)`}
                                />

                                <DetailRow label="Stats Since" value={formatDate(database.stats.statsReset)} />
                            </Stack>
                        </Paper>

                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Tables
                            </Typography>
                            <Box sx={{ width: '100%', overflowX: 'auto' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Table</TableCell>
                                            <TableCell align="right">Rows</TableCell>
                                            <TableCell align="right">Dead</TableCell>
                                            <TableCell align="right">Seq Scans</TableCell>
                                            <TableCell align="right">Idx Scans</TableCell>
                                            <TableCell align="right">MB</TableCell>
                                            <TableCell>Last Vacuum</TableCell>
                                        </TableRow>
                                    </TableHead>

                                    <TableBody>
                                        {database.tables.map((t) => (
                                            <TableRow key={`table_${t.name}`}>
                                                <TableCell>{t.name}</TableCell>
                                                <TableCell align="right">{t.liveRows.toLocaleString()}</TableCell>
                                                <TableCell
                                                    align="right"
                                                    sx={{
                                                        color:
                                                            t.deadRows > t.liveRows * DEAD_ROW_WARNING_RATIO &&
                                                            t.deadRows > 0
                                                                ? 'warning.main'
                                                                : undefined,
                                                    }}
                                                >
                                                    {t.deadRows.toLocaleString()}
                                                </TableCell>
                                                <TableCell align="right">{t.seqScan.toLocaleString()}</TableCell>
                                                <TableCell align="right">{t.idxScan.toLocaleString()}</TableCell>
                                                <TableCell align="right">{t.sizeMB}</TableCell>
                                                <TableCell>{formatDate(t.lastVacuum)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        </Box>

                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Top Statements (by total time)
                            </Typography>

                            {database.statements.available ? (
                                <Box sx={{ width: '100%', overflowX: 'auto' }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Query</TableCell>
                                                <TableCell align="right">Calls</TableCell>
                                                <TableCell align="right">Total ms</TableCell>
                                                <TableCell align="right">Mean ms</TableCell>
                                                <TableCell align="right">Max ms</TableCell>
                                            </TableRow>
                                        </TableHead>

                                        <TableBody>
                                            {database.statements.rows.map((s, i) => (
                                                <TableRow key={`statement_${String(i)}`}>
                                                    <TableCell
                                                        sx={{
                                                            whiteSpace: 'normal',
                                                            wordBreak: 'break-word',
                                                            fontFamily: 'monospace',
                                                        }}
                                                    >
                                                        {s.query}
                                                    </TableCell>
                                                    <TableCell align="right">{s.calls.toLocaleString()}</TableCell>
                                                    <TableCell align="right">{s.totalMs.toLocaleString()}</TableCell>
                                                    <TableCell align="right">{s.meanMs}</TableCell>
                                                    <TableCell align="right">{s.maxMs}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            ) : (
                                <Alert severity="info">{database.statements.message}</Alert>
                            )}
                        </Box>
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}
