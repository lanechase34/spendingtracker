import Masonry from '@mui/lab/Masonry';
import AuditLog from 'admin/components/AuditLog';
import BugLog from 'admin/components/BugLog';
import RequestMetrics from 'admin/components/RequestMetrics';
import MemoryMetrics from 'admin/components/MemoryMetrics';
import SystemMetrics from 'admin/components/SystemMetrics';
import SlowRequests from 'admin/components/SlowRequests';
import AdminLayout from 'admin/Layout';

const WIDGETS = [
    { key: 'auditLog', Component: AuditLog, props: { height: '50vh' } },
    { key: 'bugLog', Component: BugLog, props: { height: '50vh' } },
    { key: 'requestMetrics', Component: RequestMetrics },
    { key: 'memoryMetrics', Component: MemoryMetrics },
    { key: 'systemMetrics', Component: SystemMetrics },
    { key: 'slowRequests', Component: SlowRequests },
];

/**
 * Admin Dashboard supporting visualization of app health metrics, audits, and bugs
 */
export default function Dashboard() {
    return (
        <AdminLayout>
            <Masonry columns={{ xs: 1, xl: 2 }} sx={{ width: 'auto' }} spacing={3}>
                {WIDGETS.map(({ key, Component, props }) => (
                    <Component key={key} {...props} />
                ))}
            </Masonry>
        </AdminLayout>
    );
}
