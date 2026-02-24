import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import type { GridColDef } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from 'admin/Layout';
import type { ChartData, ChartOptions } from 'chart.js';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import CustomPagination from 'components/CustomPagination';
import ErrorCard from 'components/ErrorCard';
import SearchToolbar from 'components/SearchToolbar';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import useAuthFetch from 'hooks/useAuthFetch';
import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import type { CacheData, CacheKey } from 'types/CacheResponse.type';
import { CacheResponseSchema } from 'types/CacheResponse.type';
import { donutPlugins, pointerHover } from 'utils/chartPlugins';
import { safeJson } from 'utils/safeJson';
import { formatMinutesToTime } from 'utils/timeFormatter';

ChartJS.register(ArcElement, Tooltip, Legend);
dayjs.extend(relativeTime);

/**
 * ChartJS options
 */
const options: ChartOptions<'doughnut'> = {
    responsive: true,
    animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeInOutQuart',
    },
    plugins: {
        legend: {
            position: 'top',
            labels: {
                color: '#dee2e6',
            },
        },
        tooltip: {
            ...donutPlugins.tooltip,
            callbacks: { label: donutPlugins.labels.number },
        },
    },
    cutout: `50%`,
    onHover: pointerHover,
    maintainAspectRatio: false,
    devicePixelRatio: window.devicePixelRatio || 2,
};

/**
 * Calculate hit rate percentage
 */
const calculateHitRate = (hits: number, misses: number): number => {
    const total = hits + misses;
    return total > 0 ? (hits / total) * 100 : 0;
};

export default function CachePage() {
    const authFetch = useAuthFetch();
    const theme = useTheme();

    /**
     * Fetch function for TanStack Query
     */
    const fetchCacheData = async ({ signal }: { signal: AbortSignal }): Promise<CacheData> => {
        const response = await authFetch({
            url: '/spendingtracker/api/v1/admin/cachedata',
            method: 'GET',
            signal: signal,
        });

        if (!response?.ok) {
            throw new Error('Invalid network response');
        }

        // Validate the response data
        const json = await safeJson(response);
        const parsed = CacheResponseSchema.safeParse(json);

        if (!parsed.success) {
            throw new Error('Invalid response format');
        }

        const result = parsed.data;

        if (result.error) {
            throw new Error(result.messages?.[0] ?? 'Server error');
        }

        return result.data;
    };

    /**
     * TanStack Query hook - automatically handles loading, error, caching, and refetching
     */
    const {
        data: cacheData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['cacheData'],
        queryFn: fetchCacheData,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchInterval: 1000 * 60, // Auto-refetch every minute
    });

    // Calculate metrics
    const hitRate = useMemo(() => {
        if (!cacheData) return 0;
        return calculateHitRate(cacheData.hits ?? 0, cacheData.misses ?? 0);
    }, [cacheData]);

    const used = cacheData?.data.length ?? 0;
    const maxObjects = cacheData?.maxObjects ?? 0;
    const remaining = Math.max(0, maxObjects - used);
    const utilizationPercent = maxObjects > 0 ? (used / maxObjects) * 100 : 0;

    const rows: CacheKey[] = cacheData?.data ?? [];
    const columns: GridColDef<CacheKey>[] = [
        {
            field: 'key',
            headerName: 'Key',
            minWidth: 300,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 4,
        },
        {
            field: 'created',
            headerName: 'Created',
            minWidth: 200,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 1,
            valueGetter: (value: string) => dayjs(value).format('MM/DD/YYYY HH:mm:ss'),
            renderCell: (params) => (
                <Stack spacing={0.5}>
                    <Typography variant="body2">{params.formattedValue}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {dayjs(params.row.created).fromNow()}
                    </Typography>
                </Stack>
            ),
        },
        {
            field: 'hits',
            headerName: 'Hits',
            minWidth: 75,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 1,
        },
        {
            field: 'lastaccessed',
            headerName: 'Last Accessed',
            minWidth: 200,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 1,
            valueGetter: (value: string) => dayjs(value).format('MM/DD/YYYY HH:mm:ss'),
            renderCell: (params) => (
                <Stack spacing={0.5}>
                    <Typography variant="body2">{params.formattedValue}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {dayjs(params.row.lastaccessed).fromNow()}
                    </Typography>
                </Stack>
            ),
        },
        {
            field: 'lastaccesstimeout',
            headerName: 'Access Timeout',
            minWidth: 75,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 1,
            type: 'number',
            valueFormatter: (value: number) => formatMinutesToTime(value),
        },
        {
            field: 'timeout',
            headerName: 'Timeout',
            minWidth: 75,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 1,
            type: 'number',
            valueFormatter: (value: number) => formatMinutesToTime(value),
        },
    ];

    const chartData: ChartData<'doughnut'> = useMemo(
        () => ({
            labels: ['Used', 'Remaining'],
            datasets: [
                {
                    label: 'Cache Fullness',
                    data: [used, remaining],
                    backgroundColor: [
                        utilizationPercent > 80 ? theme.palette.warning.main : theme.palette.primary.main,
                        theme.palette.grey[700],
                    ],
                    hoverBackgroundColor: [
                        utilizationPercent > 80 ? theme.palette.warning.light : theme.palette.primary.light,
                        theme.palette.grey[600],
                    ],
                    hoverOffset: 4,
                    borderWidth: 0,
                },
            ],
        }),
        [used, remaining, utilizationPercent, theme]
    );

    return (
        <AdminLayout>
            {isError ? (
                <ErrorCard />
            ) : (
                <Stack spacing={3}>
                    {/* Main Content Grid */}
                    <Grid container spacing={2} alignItems="stretch">
                        {/* Summary Cards */}
                        <Grid size={{ xs: 12, lg: 8 }} container spacing={2} alignItems="stretch">
                            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="overline">
                                            Hit Rate
                                        </Typography>
                                        <Typography variant="h4" color={hitRate > 80 ? 'success.main' : 'text.primary'}>
                                            {hitRate.toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {cacheData?.hits ?? 0} hits / {cacheData?.misses ?? 0} misses
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="overline">
                                            Utilization
                                        </Typography>
                                        <Typography
                                            variant="h4"
                                            color={utilizationPercent > 80 ? 'warning.main' : 'text.primary'}
                                        >
                                            {utilizationPercent.toFixed(1)}%
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {used} / {maxObjects} keys
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="overline">
                                            Evictions
                                        </Typography>
                                        <Typography variant="h4">{cacheData?.evictionCount ?? 0}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Total evicted keys
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    <CardContent>
                                        <Typography color="text.secondary" gutterBottom variant="overline">
                                            GC Count
                                        </Typography>
                                        <Typography variant="h4">{cacheData?.garbageCollections ?? 0}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Garbage collections
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <Grid size={{ xs: 12, lg: 4 }}>
                            <Card sx={{ height: '100%' }}>
                                <CardHeader
                                    title="Cache Utilization"
                                    sx={{ pb: 1 }}
                                    slotProps={{ title: { variant: 'h6' } }}
                                />
                                <Divider />
                                <CardContent
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        minHeight: 300,
                                    }}
                                >
                                    <Box sx={{ width: '100%', maxWidth: 280, height: 280 }}>
                                        <Doughnut data={chartData} options={options} />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
                                        {utilizationPercent > 80 && 'Warning: Cache nearly full'}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Cache Keys Table */}
                    <Card sx={{ height: 'calc(75vh)' }}>
                        <DataGrid
                            initialState={{
                                pagination: { paginationModel: { pageSize: 25, page: 0 } },
                                sorting: { sortModel: [{ field: 'key', sort: 'asc' }] },
                            }}
                            paginationMode="client"
                            filterMode="client"
                            sortingMode="client"
                            pageSizeOptions={[10, 25, 100]}
                            rows={rows}
                            columns={columns}
                            loading={isLoading}
                            disableColumnSelector
                            disableColumnMenu
                            disableColumnFilter
                            showToolbar
                            slots={{
                                toolbar: () => <SearchToolbar title="Cache Keys" />,
                                noRowsOverlay: () => (
                                    <Typography sx={{ p: 2, textAlign: 'center' }}>No Cache Keys Found</Typography>
                                ),
                            }}
                            slotProps={{
                                basePagination: {
                                    material: {
                                        ActionsComponent: CustomPagination,
                                    },
                                },
                            }}
                        />
                    </Card>
                </Stack>
            )}
        </AdminLayout>
    );
}
