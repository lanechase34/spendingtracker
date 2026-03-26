import Masonry from '@mui/lab/Masonry';
import MemoryMetrics from 'admin/components/MemoryMetrics';
import RequestMetrics from 'admin/components/RequestMetrics';
import SlowRequests from 'admin/components/SlowRequests';
import SystemMetrics from 'admin/components/SystemMetrics';

export default function MetricsPage() {
    return (
        <Masonry columns={{ xs: 1, xl: 2 }} sx={{ width: 'auto' }} spacing={3}>
            <RequestMetrics />
            <MemoryMetrics />
            <SystemMetrics />
            <SlowRequests />
        </Masonry>
    );
}
