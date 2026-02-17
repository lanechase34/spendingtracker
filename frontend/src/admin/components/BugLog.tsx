import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import CustomPagination from 'components/CustomPagination';
import DetailRow from 'components/DetailRow';
import ErrorCard from 'components/ErrorCard';
import ExceptionDetail from 'components/ExceptionDetail';
import SearchToolbar from 'components/SearchToolbar';
import dayjs from 'dayjs';
import useDateRangeContext from 'hooks/useDateRangeContext';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import { useMemo, useState } from 'react';
import type { Bug } from 'types/Bug.type';
import type { BugLog } from 'types/BugLog.type';
import { BugLogSchema } from 'types/BugLog.type';

interface BugLogProps {
    height?: string;
}

/**
 * Bug Log Data Grid Viewer
 */
export default function BugLog({ height = 'calc(100vh - 100px)' }: BugLogProps) {
    const { formattedStartDate, formattedEndDate } = useDateRangeContext();

    /**
     * Additional params used by API
     */
    const additionalParams = useMemo(
        () => ({
            startDate: formattedStartDate,
            endDate: formattedEndDate,
        }),
        [formattedStartDate, formattedEndDate]
    );

    /**
     * usePaginatedFetch hook
     */
    const {
        data,
        loading,
        error,
        paginationModel,
        sortModel,
        filterModel,
        totalRowCount,
        handlePaginationModelChange,
        handleSortModelChange,
        handleFilterModelChange,
    } = usePaginatedFetch({
        endpoint: '/spendingtracker/api/v1/admin/bugs',
        initialPageSize: 10,
        additionalParams,
        validator: BugLogSchema,
        defaultSort: [{ field: 'created', sort: 'desc' }],
    });

    /**
     * Viewing Bug row details
     */
    const [selectedBug, setSelectedBug] = useState<Bug | null>(null);

    if (error) {
        return <ErrorCard />;
    }

    // Rows of Bugs
    const rows: Bug[] = data?.bugs ?? [];

    // Columns are the Bug properties
    const columns: GridColDef<Bug>[] = [
        {
            field: 'created',
            valueGetter: (value: string) => {
                // format for display, sorting, etc
                return dayjs(value).format('MM/DD/YYYY HH:mm:ss');
            },
            headerName: 'Timestamp',
            minWidth: 100,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 2,
        },
        {
            field: 'ip',
            headerName: 'IP',
            minWidth: 100,
            hideable: false,
            cellClassName: 'centered-col',
            flex: 1,
        },
        {
            field: 'urlpath',
            headerName: 'URL',
            flex: 3,
            minWidth: 150,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'method',
            headerName: 'Method',
            flex: 1,
            minWidth: 50,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'agent',
            headerName: 'Agent',
            flex: 1,
            minWidth: 50,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'detail',
            headerName: 'Detail',
            flex: 1,
            minWidth: 200,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'email',
            headerName: 'User',
            flex: 1,
            minWidth: 75,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'actions',
            renderCell: (params: GridRenderCellParams<Bug, boolean>) => {
                return (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Button variant="outlined" onClick={() => setSelectedBug(params.row)}>
                            <ZoomInIcon fontSize="small" />
                        </Button>
                    </Box>
                );
            },
            headerName: '',
            minWidth: 100,
            hideable: false,
            sortable: false,
            filterable: false,
        },
    ];

    return (
        <>
            <Box sx={{ height: height }}>
                <DataGrid
                    paginationMode="server"
                    paginationModel={paginationModel}
                    onPaginationModelChange={handlePaginationModelChange}
                    filterMode="server"
                    filterModel={filterModel}
                    onFilterModelChange={handleFilterModelChange}
                    sortingMode="server"
                    sortModel={sortModel}
                    onSortModelChange={handleSortModelChange}
                    pageSizeOptions={[10, 25, 100]}
                    rows={rows}
                    rowCount={totalRowCount}
                    columns={columns}
                    loading={loading}
                    disableColumnSelector
                    disableColumnMenu
                    disableColumnFilter
                    showToolbar
                    slots={{
                        toolbar: () => <SearchToolbar title="Bug Log" />,
                        noRowsOverlay: () => <Typography sx={{ p: 2, textAlign: 'center' }}>No Bugs Found</Typography>,
                    }}
                    slotProps={{
                        basePagination: {
                            material: {
                                ActionsComponent: CustomPagination,
                            },
                        },
                    }}
                />
            </Box>

            <Dialog open={Boolean(selectedBug)} onClose={() => setSelectedBug(null)} maxWidth="md" fullWidth>
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    Details
                    <IconButton aria-label="close" onClick={() => setSelectedBug(null)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedBug && (
                        <Stack spacing={1}>
                            <DetailRow
                                label="Timestamp"
                                value={dayjs(selectedBug.created).format('MM/DD/YYYY HH:mm:ss')}
                            />
                            <DetailRow label="IP Address" value={selectedBug.ip} />
                            <DetailRow label="User Email" value={selectedBug.email ?? '—'} />
                            <DetailRow label="User Agent" value={selectedBug.agent} />

                            <Divider />

                            <DetailRow label="Method" value={selectedBug.method} />
                            <DetailRow label="URL Path" value={selectedBug.urlpath} />

                            <Divider />

                            <DetailRow label="Detail" value={selectedBug.detail} multiline />

                            <Divider />

                            <ExceptionDetail blob={selectedBug.stack} />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button variant="outlined" onClick={() => setSelectedBug(null)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
