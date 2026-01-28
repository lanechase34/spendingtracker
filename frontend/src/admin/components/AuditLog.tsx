import { useMemo, useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Typography from '@mui/material/Typography';
import ErrorCard from 'components/ErrorCard';
import SearchToolbar from 'components/SearchToolbar';
import CustomPagination from 'components/CustomPagination';
import dayjs from 'dayjs';
import type { AuditLog } from 'types/AuditLog.type';
import useDateRangeContext from 'hooks/useDateRangeContext';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import { AuditLogSchema } from 'types/AuditLog.type';
import type { Audit } from 'types/Audit.type';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import DetailRow from 'components/DetailRow';

interface AuditLogProps {
    height?: string;
}

/**
 * Audit Log Data Grid Viewer
 */
export default function AuditLog({ height = 'calc(100vh - 100px)' }: AuditLogProps) {
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
        endpoint: '/spendingtracker/api/v1/admin/audits',
        initialPageSize: 100,
        additionalParams,
        validator: AuditLogSchema,
        defaultSort: [{ field: 'created', sort: 'desc' }],
    });

    /**
     * Viewing audit row details
     */
    const [selectedAudit, setSelectedAudit] = useState<Audit | null>(null);

    if (error) {
        return <ErrorCard />;
    }

    // Rows of audits
    const rows: Audit[] = data?.audits ?? [];

    // Columns are the audit properties
    const columns: GridColDef<Audit>[] = [
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
            field: 'statuscode',
            headerName: 'Statuscode',
            flex: 1,
            minWidth: 75,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'delta',
            headerName: 'Delta',
            flex: 1,
            minWidth: 75,
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
            renderCell: (params: GridRenderCellParams<Audit, boolean>) => {
                return (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Button variant="outlined" onClick={() => setSelectedAudit(params.row)}>
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
                        toolbar: () => <SearchToolbar title="Audit Log" />,
                        noRowsOverlay: () => (
                            <Typography sx={{ p: 2, textAlign: 'center' }}>No Audits Found</Typography>
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
            </Box>

            <Dialog open={Boolean(selectedAudit)} onClose={() => setSelectedAudit(null)} maxWidth="md" fullWidth>
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    Details
                    <IconButton aria-label="close" onClick={() => setSelectedAudit(null)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedAudit && (
                        <Stack spacing={1}>
                            <DetailRow
                                label="Timestamp"
                                value={dayjs(selectedAudit.created).format('MM/DD/YYYY HH:mm:ss')}
                            />
                            <DetailRow label="IP Address" value={selectedAudit.ip} />
                            <DetailRow label="User Email" value={selectedAudit.email ?? '—'} />
                            <DetailRow label="User Agent" value={selectedAudit.agent} />

                            <Divider />

                            <DetailRow label="Method" value={selectedAudit.method} />
                            <DetailRow label="URL Path" value={selectedAudit.urlpath} />
                            <DetailRow label="Status Code" value={selectedAudit.statuscode} />
                            <DetailRow label="Delta (ms)" value={selectedAudit.delta} />

                            <Divider />

                            <DetailRow label="Detail" value={selectedAudit.detail} multiline />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button variant="outlined" onClick={() => setSelectedAudit(null)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
