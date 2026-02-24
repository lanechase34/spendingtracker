import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import ConfirmDialog from 'components/ConfirmDialog';
import CustomPagination from 'components/CustomPagination';
import DeleteButton from 'components/DeleteButton';
import ErrorCard from 'components/ErrorCard';
import SearchToolbar from 'components/SearchToolbar';
import TotalFooter from 'components/TotalFooter';
import dayjs from 'dayjs';
import useCurrencyFormatter from 'hooks/useCurrencyFormatter';
import useSubscriptionContext from 'hooks/useSubscriptionContext';
import type { MouseEvent } from 'react';
import { useCallback, useState } from 'react';
import type { Subscription } from 'types/Subscription.type';

type SubscriptionAction =
    | { type: 'toggle'; id: number }
    | { type: 'delete'; id: number; status?: 'confirming' | 'processing' }
    | null;

export default function SubscriptionList() {
    const { formatCurrency } = useCurrencyFormatter({});

    /**
     * Context handles state of susbcription list
     */
    const {
        subscriptions,
        totalSum,
        filteredSum,
        deleteSubscription,
        toggleSubscription,
        selectedInterval,
        handleIntervalChange,
        loading,
        error,
        paginationModel,
        sortModel,
        filterModel,
        totalRowCount,
        handlePaginationModelChange,
        handleSortModelChange,
        handleFilterModelChange,
    } = useSubscriptionContext();

    /**
     * Action button state - track the current action and status of action
     */
    const [activeAction, setActiveAction] = useState<SubscriptionAction>(null);

    /**
     * Deleting subscription
     */
    const handleDeleteClick = (subscriptionId: number | string) => {
        setActiveAction({
            type: 'delete',
            status: 'confirming',
            id:
                typeof subscriptionId === 'number' && !isNaN(subscriptionId) && isFinite(subscriptionId)
                    ? subscriptionId
                    : -1,
        });
    };

    const confirmedDelete = useCallback(async () => {
        if (activeAction === null) return;
        if (activeAction.type === 'delete' && activeAction.status === 'processing') return;

        setActiveAction({ ...activeAction, type: 'delete', status: 'processing' });
        await deleteSubscription(activeAction.id);

        setActiveAction(null);
    }, [activeAction, deleteSubscription]);

    /**
     * Toggling subscription
     */
    const handleSubscriptionToggle = async (row: Subscription) => {
        if (activeAction !== null) return; // prevent double-trigger
        setActiveAction({ type: 'toggle', id: row.id });
        await toggleSubscription(row);
        setActiveAction(null);
    };

    if (error) {
        return <ErrorCard />;
    }

    // Rows of Subscriptions
    const rows: Subscription[] = subscriptions ?? [];

    // Columns are the expense properties
    const columns: GridColDef<Subscription>[] = [
        {
            field: 'nextChargeDate',
            valueGetter: (value: string, row: Subscription) => {
                if (!row.active) return '---';
                return dayjs(value).format('MM/DD/YYYY');
            },
            headerName: 'Next Charge',
            width: 150,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'amount',
            valueFormatter: (value?: number) => {
                return value == null ? '' : formatCurrency(value);
            },
            headerName: 'Amount',
            width: 120,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'description',
            headerName: 'Description',
            flex: 1,
            minWidth: 75,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'category',
            headerName: 'Category',
            flex: 1,
            minWidth: 75,
            hideable: false,
            cellClassName: 'centered-col',
        },
        {
            field: 'interval',
            headerName: '',
            minWidth: 150,
            hideable: false,
            sortable: false,
            renderHeader: () => {
                return (
                    <FormControl sx={{ my: 1, minWidth: 100 }} size="small">
                        <InputLabel id="interval-filter-label">Interval</InputLabel>
                        <Select
                            labelId="interval-filter-label"
                            id="interval-filter"
                            label="Interval"
                            value={selectedInterval}
                            onChange={handleIntervalChange}
                            autoWidth
                        >
                            <MenuItem value="">All</MenuItem>
                            <MenuItem value={'Y'} data-testid="yearly">
                                Yearly
                            </MenuItem>
                            <MenuItem value={'M'} data-testid="monthly">
                                Monthly
                            </MenuItem>
                        </Select>
                    </FormControl>
                );
            },
            valueGetter: (value: string) => {
                return value == 'Y' ? 'Yearly' : value == 'M' ? 'Monthly' : '';
            },
            cellClassName: 'centered-col',
        },
        {
            field: 'active',
            align: 'center',
            renderCell: (params: GridRenderCellParams<Subscription, number>) => {
                return (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                    >
                        <ButtonGroup variant="outlined">
                            <Button
                                color={params.value ? 'warning' : 'success'}
                                aria-label={params.value ? 'Pause subscription' : 'Resume subscription'}
                                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                    event.preventDefault();
                                    event.stopPropagation(); // stop row selection
                                    void handleSubscriptionToggle(params.row);
                                }}
                                data-pk={params.id}
                                disabled={!!activeAction}
                            >
                                {activeAction?.type === 'toggle' && activeAction.id === params.id ? (
                                    <CircularProgress size={16} color="inherit" />
                                ) : params.value ? (
                                    <PauseIcon fontSize="small" />
                                ) : (
                                    <PlayArrowIcon fontSize="small" />
                                )}
                            </Button>
                            <DeleteButton
                                rowId={params.id as number}
                                onClick={handleDeleteClick}
                                disabled={!!activeAction}
                            />
                        </ButtonGroup>
                    </Box>
                );
            },
            headerName: '',
            minWidth: 125,
            hideable: false,
            sortable: false,
        },
    ];

    return (
        <>
            <div style={{ height: 600 }}>
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
                        toolbar: () => {
                            return <SearchToolbar title="Subscription List" />;
                        },
                        footer: () => {
                            return <TotalFooter totalSum={totalSum ?? null} filteredSum={filteredSum ?? null} />;
                        },
                        noRowsOverlay: () => (
                            <Typography sx={{ p: 2, textAlign: 'center' }}>No Subscriptions Found</Typography>
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
            </div>

            {activeAction?.type === 'delete' && (
                <ConfirmDialog
                    open={activeAction.status === 'confirming' || activeAction.status === 'processing'}
                    message="This will permanently delete your subscription and any receipt, proceed?"
                    handleClose={() => {
                        setActiveAction(null);
                    }}
                    handleConfirm={() => {
                        void confirmedDelete();
                    }}
                    confirmed={activeAction.status === 'processing'}
                />
            )}
        </>
    );
}
