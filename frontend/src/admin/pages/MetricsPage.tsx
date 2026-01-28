import AdminLayout from 'admin/Layout';
import RequestMetrics from 'admin/components/RequestMetrics';
import MemoryMetrics from 'admin/components/MemoryMetrics';
import SystemMetrics from 'admin/components/SystemMetrics';
import SlowRequests from 'admin/components/SlowRequests';
import Masonry from '@mui/lab/Masonry';

export default function MetricsPage() {
    return (
        <AdminLayout>
            <Masonry columns={{ xs: 1, xl: 2 }} sx={{ width: 'auto' }} spacing={3}>
                <RequestMetrics />
                <MemoryMetrics />
                <SystemMetrics />
                <SlowRequests />
            </Masonry>
        </AdminLayout>
    );
}
