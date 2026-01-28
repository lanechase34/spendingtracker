import { useState } from 'react';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Typography from '@mui/material/Typography';
import ErrorCard from 'components/ErrorCard';
import SearchToolbar from 'components/SearchToolbar';
import CustomPagination from 'components/CustomPagination';
import dayjs from 'dayjs';
import type { UserRecord } from 'types/UserList.type';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import { UserListSchema } from 'types/UserList.type';
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
import Chip from '@mui/material/Chip';
import CheckIcon from '@mui/icons-material/Check';
import AdminLayout from 'admin/Layout';
import { ucFirst } from 'utils/ucFirst';

function getSecurityLevelColor(security_level: string) {
    return security_level === 'ADMIN' ? 'primary' : security_level === 'UNVERIFIED' ? 'warning' : 'default';
}

/**
 * Users Page viewer
 */
export default function UsersPage() {
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
        endpoint: '/spendingtracker/api/v1/users',
        initialPageSize: 25,
        validator: UserListSchema,
        defaultSort: [{ field: 'lastlogin', sort: 'desc' }],
    });

    /**
     * Viewing user details
     */
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);

    if (error) {
        return (
            <AdminLayout>
                <ErrorCard />
            </AdminLayout>
        );
    }

    // Rows of users
    const rows: UserRecord[] = data?.users ?? [];

    // Columns
    const columns: GridColDef<UserRecord>[] = [
        {
            field: 'email',
            headerName: 'Email',
            flex: 2,
            minWidth: 200,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'security_level',
            headerName: 'Security Level',
            flex: 1,
            minWidth: 130,
            hideable: false,
            renderCell: (params: GridRenderCellParams<UserRecord>) => (
                <Chip
                    label={ucFirst(params.row.security_level)}
                    size="small"
                    color={getSecurityLevelColor(params.row.security_level)}
                />
            ),
            cellClassName: 'centered-col',
        },
        {
            field: 'verified',
            headerName: 'Verified',
            flex: 1,
            minWidth: 75,
            hideable: false,
            type: 'boolean',
            renderCell: (params: GridRenderCellParams<UserRecord>) =>
                params.value ? <CheckIcon color="success" fontSize="small" /> : null,
            cellClassName: 'centered-col',
        },
        {
            field: 'lastlogin',
            headerName: 'Last Login',
            flex: 1,
            minWidth: 180,
            hideable: false,
            valueGetter: (value: string) => {
                return value ? dayjs(value).format('MM/DD/YYYY HH:mm:ss') : 'Never';
            },
            cellClassName: 'centered-col',
        },
        {
            field: 'actions',
            renderCell: (params: GridRenderCellParams<UserRecord>) => {
                return (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Button variant="outlined" onClick={() => setSelectedUser(params.row)}>
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
            cellClassName: 'centered-col',
        },
    ];

    return (
        <AdminLayout>
            <Box sx={{ height: 'calc(100vh - 100px)' }}>
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
                    getRowId={(row) => row.id}
                    slots={{
                        toolbar: () => <SearchToolbar title="Users" />,
                        noRowsOverlay: () => <Typography sx={{ p: 2, textAlign: 'center' }}>No Users Found</Typography>,
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

            <Dialog open={Boolean(selectedUser)} onClose={() => setSelectedUser(null)} maxWidth="sm" fullWidth>
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}
                >
                    User Details
                    <IconButton aria-label="close" onClick={() => setSelectedUser(null)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedUser && (
                        <Stack spacing={2}>
                            <DetailRow label="User ID" value={selectedUser.id} />
                            <DetailRow label="Email" value={selectedUser.email} />

                            <Divider />

                            <DetailRow
                                label="Security Level"
                                value={
                                    <Chip
                                        label={ucFirst(selectedUser.security_level)}
                                        size="small"
                                        color={getSecurityLevelColor(selectedUser.security_level)}
                                    />
                                }
                            />
                            <DetailRow
                                label="Verified"
                                value={selectedUser.verified ? <CheckIcon color="success" /> : 'No'}
                            />

                            <Divider />

                            <DetailRow
                                label="Last Login"
                                value={
                                    selectedUser.lastlogin
                                        ? dayjs(selectedUser.lastlogin).format('MM/DD/YYYY HH:mm:ss')
                                        : 'Never logged in'
                                }
                            />
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button variant="outlined" onClick={() => setSelectedUser(null)}>
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </AdminLayout>
    );
}
