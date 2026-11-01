import Masonry from '@mui/lab/Masonry';
import AuditLog from 'admin/components/AuditLog';
import BugLog from 'admin/components/BugLog';
import DatabaseMetrics from 'admin/components/DatabaseMetrics';
import MemoryMetrics from 'admin/components/MemoryMetrics';
import QueryMetrics from 'admin/components/QueryMetrics';
import RateLimitMetrics from 'admin/components/RateLimitMetrics';
import RequestMetrics from 'admin/components/RequestMetrics';
import SlowQueries from 'admin/components/SlowQueries';
import SlowRequests from 'admin/components/SlowRequests';
import SystemMetrics from 'admin/components/SystemMetrics';

const WIDGETS = [
    { key: 'auditLog', Component: AuditLog, props: { height: '50vh' } },
    { key: 'bugLog', Component: BugLog, props: { height: '50vh' } },
    { key: 'requestMetrics', Component: RequestMetrics },
    { key: 'queryMetrics', Component: QueryMetrics },
    { key: 'memoryMetrics', Component: MemoryMetrics },
    { key: 'databaseMetrics', Component: DatabaseMetrics },
    { key: 'systemMetrics', Component: SystemMetrics },
    { key: 'rateLimitMetrics', Component: RateLimitMetrics },
    { key: 'slowRequests', Component: SlowRequests },
    { key: 'slowQueries', Component: SlowQueries },
];

/**
 * Admin Dashboard supporting visualization of app health metrics, audits, and bugs
 */
export default function Dashboard() {
    return (
        <Masonry columns={{ xs: 1, xl: 2 }} sx={{ width: 'auto' }} spacing={3}>
            {WIDGETS.map(({ key, Component, props }) => (
                <Component key={key} {...props} />
            ))}
        </Masonry>
    );
}
