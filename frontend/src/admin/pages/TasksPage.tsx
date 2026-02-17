import CheckIcon from '@mui/icons-material/Check';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from 'admin/Layout';
import CustomPagination from 'components/CustomPagination';
import ErrorCard from 'components/ErrorCard';
import SearchToolbar from 'components/SearchToolbar';
import dayjs from 'dayjs';
import useAuthFetch from 'hooks/useAuthFetch';
import { useMemo } from 'react';
import type { TaskRecord } from 'types/TaskResponse.type';
import { TaskResponseSchema } from 'types/TaskResponse.type';
import { safeJson } from 'utils/safeJson';

export default function TasksPage() {
    const authFetch = useAuthFetch();

    /**
     * Fetch function for TanStack Query
     */
    const fetchTaskData = async ({ signal }: { signal: AbortSignal }): Promise<TaskRecord[]> => {
        const response = await authFetch({
            url: '/spendingtracker/api/v1/admin/taskdata',
            method: 'GET',
            signal: signal,
        });

        if (!response?.ok) {
            throw new Error('Invalid network response');
        }

        const json = await safeJson(response);
        const parsed = TaskResponseSchema.safeParse(json);

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
     * TanStack Query hook
     */
    const {
        data: taskData,
        isLoading,
        isError,
    } = useQuery({
        queryKey: ['taskData'],
        queryFn: fetchTaskData,
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchInterval: 1000 * 60, // Auto-refetch every minute
    });

    const rows: TaskRecord[] = taskData ?? [];
    const columns: GridColDef<TaskRecord>[] = useMemo(
        () => [
            {
                field: 'name',
                headerName: 'Task',
                minWidth: 200,
                flex: 2,
                hideable: false,
                cellClassName: 'centered-col',
            },
            {
                field: 'created',
                headerName: 'Created',
                minWidth: 180,
                flex: 1,
                valueFormatter: (value: string) => dayjs(value).format('MM/DD/YYYY HH:mm:ss'),
                cellClassName: 'centered-col',
            },
            {
                field: 'module',
                headerName: 'Module',
                minWidth: 120,
                flex: 1,
                cellClassName: 'centered-col',
            },
            {
                field: 'executor',
                headerName: 'Executor',
                minWidth: 150,
                flex: 1,
                cellClassName: 'centered-col',
            },
            {
                field: 'lastRun',
                headerName: 'Last Run',
                minWidth: 180,
                flex: 1,
                valueGetter: (value: string) => (value ? dayjs(value).format('MM/DD/YYYY HH:mm:ss') : 'Never'),
                cellClassName: 'centered-col',
            },
            {
                field: 'nextRun',
                headerName: 'Next Run',
                minWidth: 180,
                flex: 1,
                valueGetter: (value: string) => (value ? dayjs(value).format('MM/DD/YYYY HH:mm:ss') : 'N/A'),
                cellClassName: 'centered-col',
            },
            {
                field: 'totalFailures',
                headerName: 'Failures',
                minWidth: 100,
                type: 'number',
                renderCell: (params: GridRenderCellParams<TaskRecord>) => (
                    <Chip
                        label={params.row.totalFailures}
                        size="small"
                        color={params.row.totalFailures > 0 ? 'error' : 'default'}
                    />
                ),
                cellClassName: 'centered-col',
            },
            {
                field: 'totalSuccess',
                headerName: 'Successes',
                minWidth: 100,
                type: 'number',
                renderCell: (params: GridRenderCellParams<TaskRecord>) => (
                    <Chip
                        label={params.row.totalSuccess}
                        size="small"
                        color={params.row.totalSuccess > 0 ? 'success' : 'default'}
                    />
                ),
                cellClassName: 'centered-col',
            },
            {
                field: 'totalRuns',
                headerName: 'Total Runs',
                minWidth: 100,
                type: 'number',
                cellClassName: 'centered-col',
            },
            {
                field: 'lastExecutionTime',
                headerName: 'Last Exec Time',
                minWidth: 150,
                type: 'number',
                valueFormatter: (value: number) => (value > 0 ? `${value}ms` : 'N/A'),
                cellClassName: 'centered-col',
            },
            {
                field: 'error',
                headerName: 'Error',
                minWidth: 80,
                type: 'boolean',
                renderCell: (params) => (params.value ? <CheckIcon color="error" fontSize="small" /> : null),
                cellClassName: 'centered-col',
            },
            {
                field: 'errorMessage',
                headerName: 'Message',
                minWidth: 200,
                flex: 2,
                cellClassName: 'centered-col',
            },
            {
                field: 'scheduled',
                headerName: 'Scheduled',
                minWidth: 100,
                type: 'boolean',
                renderCell: (params) => (params.value ? <CheckIcon color="success" fontSize="small" /> : null),
                cellClassName: 'centered-col',
            },
        ],
        []
    );

    return (
        <AdminLayout>
            {isError ? (
                <ErrorCard />
            ) : (
                <Card>
                    <DataGrid
                        initialState={{
                            pagination: { paginationModel: { pageSize: 25, page: 0 } },
                            columns: {
                                columnVisibilityModel: {
                                    // Hide less important columns by default
                                    cacheName: false,
                                    constrained: false,
                                    debug: false,
                                    serverFixation: false,
                                },
                            },
                            sorting: {
                                sortModel: [{ field: 'nextRun', sort: 'asc' }],
                            },
                        }}
                        paginationMode="client"
                        filterMode="client"
                        sortingMode="client"
                        pageSizeOptions={[10, 25, 100]}
                        rows={rows}
                        columns={columns}
                        loading={isLoading}
                        disableColumnFilter
                        autoHeight
                        showToolbar
                        getRowId={(row) => row.name}
                        slots={{
                            toolbar: () => <SearchToolbar title="Scheduled Tasks" />,
                            noRowsOverlay: () => (
                                <Typography sx={{ p: 2, textAlign: 'center' }}>No Tasks Found</Typography>
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
            )}
        </AdminLayout>
    );
}
