import Masonry from '@mui/lab/Masonry';
import Stack from '@mui/material/Stack';
import DatabaseDiagnostics from 'admin/components/DatabaseDiagnostics';
import DatabaseMetrics from 'admin/components/DatabaseMetrics';
import MemoryMetrics from 'admin/components/MemoryMetrics';
import QueryMetrics from 'admin/components/QueryMetrics';
import RateLimitMetrics from 'admin/components/RateLimitMetrics';
import RequestMetrics from 'admin/components/RequestMetrics';
import ServerInfo from 'admin/components/ServerInfo';
import SlowQueries from 'admin/components/SlowQueries';
import SlowRequests from 'admin/components/SlowRequests';
import SystemMetrics from 'admin/components/SystemMetrics';

/**
 * Live metrics pushed over the socket every 5s, followed by the polled diagnostics
 * Database diagnostics has wide tables so it spans the full width
 */
export default function MetricsPage() {
    return (
        <Stack spacing={3}>
            <Masonry columns={{ xs: 1, xl: 2 }} sx={{ width: 'auto' }} spacing={3}>
                <RequestMetrics />
                <QueryMetrics />
                <MemoryMetrics />
                <DatabaseMetrics />
                <SystemMetrics />
                <RateLimitMetrics />
                <ServerInfo />
                <SlowRequests />
                <SlowQueries />
            </Masonry>

            <DatabaseDiagnostics />
        </Stack>
    );
}
