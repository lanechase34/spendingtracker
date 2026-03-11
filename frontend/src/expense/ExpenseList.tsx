import ListIcon from '@mui/icons-material/List';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
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
import useExpenseContext from 'hooks/useExpenseContext';
import type { MouseEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { Expense } from 'types/Expense.type';

import ExpenseDetailDialog from './ExpenseDetailDialog';

/**
 * Data grid slots
 */
function ToolbarSlot() {
    return <SearchToolbar title="Expense List" />;
}

function NoRowsSlot() {
    return <Typography sx={{ p: 2, textAlign: 'center' }}>No Expenses Found</Typography>;
}

declare module '@mui/x-data-grid' {
    interface FooterPropsOverrides {
        totalSum: number | null;
        filteredSum: number | null;
    }
}

function FooterSlot({ totalSum, filteredSum }: { totalSum: number | null; filteredSum: number | null }) {
    return <TotalFooter totalSum={totalSum} filteredSum={filteredSum} />;
}

export default function ExpenseList() {
    const { formatCurrency } = useCurrencyFormatter({});

    /**
     * Context handles state of expense list
     */
    const {
        expenses,
        totalSum,
        filteredSum,
        loading,
        error,
        paginationModel,
        sortModel,
        filterModel,
        deleteExpense,
        totalRowCount,
        handlePaginationModelChange,
        handleSortModelChange,
        handleFilterModelChange,
    } = useExpenseContext();

    /**
     * Selected Expense dialog
     */
    const [detailOpen, setDetailOpen] = useState<boolean>(false);
    const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<Expense | null>(null);
    const handleOpenDetail = useCallback((expense: Expense) => {
        setSelectedExpenseDetail(expense);
        setDetailOpen(true);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setDetailOpen(false);
    }, []);

    /**
     * Deleting expense
     */
    const [selectedExpense, setSelectedExpense] = useState<number>(-1);
    const [deletingExpense, setDeletingExpense] = useState<boolean>(false);

    const handleDeleteClick = useCallback((expenseId: number | string) => {
        setSelectedExpense(typeof expenseId === 'number' && !isNaN(expenseId) && isFinite(expenseId) ? expenseId : -1);
    }, []);

    const confirmedDelete = useCallback(async () => {
        if (deletingExpense) return;
        setDeletingExpense(true);
        await deleteExpense(selectedExpense);
        setDeletingExpense(false);
        setSelectedExpense(-1);
    }, [deleteExpense, deletingExpense, selectedExpense]);

    // Rows of expenses
    const rows = useMemo<Expense[]>(() => expenses ?? [], [expenses]);

    // Columns are the expense properties
    const columns: GridColDef<Expense>[] = useMemo(
        () => [
            {
                field: 'date',
                valueGetter: (value: string) => {
                    // format for display, sorting, etc
                    return dayjs(value).format('MM/DD/YYYY');
                    //return new Date(value).toLocaleDateString();
                },
                headerName: 'Date',
                width: 130,
                hideable: false,
                cellClassName: 'centered-col',
            },
            {
                field: 'amount',
                valueFormatter: (value?: number) => {
                    // display only
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
                field: 'receipt',
                renderCell: (params: GridRenderCellParams<Expense, boolean>) => {
                    return (
                        <Box
                            sx={{
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'right',
                            }}
                        >
                            <ButtonGroup variant="outlined">
                                <Button
                                    aria-label="Expense Detail"
                                    onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                        event.preventDefault();
                                        event.stopPropagation(); // stop row selection
                                        handleOpenDetail(params.row);
                                    }}
                                >
                                    <ListIcon fontSize="small" />
                                </Button>
                                <DeleteButton
                                    rowId={params.id as number}
                                    onClick={handleDeleteClick}
                                    disabled={deletingExpense}
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
        ],
        [deletingExpense, formatCurrency, handleOpenDetail, handleDeleteClick]
    );

    if (error) {
        return <ErrorCard />;
    }

    return (
        <>
            <Box sx={{ height: 600 }}>
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
                        toolbar: ToolbarSlot,
                        footer: FooterSlot,
                        noRowsOverlay: NoRowsSlot,
                    }}
                    slotProps={{
                        footer: { totalSum: totalSum ?? null, filteredSum: filteredSum ?? null },
                        basePagination: {
                            material: {
                                ActionsComponent: CustomPagination,
                            },
                        },
                    }}
                />
            </Box>

            <ExpenseDetailDialog
                open={detailOpen}
                expense={selectedExpenseDetail}
                onClose={handleCloseDetail}
                onExited={() => setSelectedExpenseDetail(null)}
            />

            {selectedExpense > 0 && (
                <ConfirmDialog
                    open={true}
                    message="This will permanently delete your expense and any receipt, proceed?"
                    handleClose={() => {
                        setSelectedExpense(-1);
                    }}
                    handleConfirm={() => {
                        void confirmedDelete();
                    }}
                    confirmed={deletingExpense}
                />
            )}
        </>
    );
}
