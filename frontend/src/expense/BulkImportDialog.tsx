import type { ExpenseDataRow } from 'types/Expense.type';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Box from '@mui/material/Box';
import CloseIcon from '@mui/icons-material/Close';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import DialogActions from '@mui/material/DialogActions';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import Divider from '@mui/material/Divider';
import BulkImportRow from './BulkImportRow';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import type { ErrorField } from 'validators/validateExpenseRow';
import Stack from '@mui/material/Stack';
import type { ErroredExpense } from 'types/BulkImport.type';
import BulkImportErrors from './BulkImportErrors';

interface BulkImportDialogProps {
    open: boolean;
    loading: boolean;
    saving: boolean;
    rowOrder: string[];
    loadedExpenses: Record<string, ExpenseDataRow>;
    importErrors: ErroredExpense[];
    clearImportErrors: () => void;
    errors: Record<string, ErrorField[]>;
    onClose: () => void;
    onBulkSave: () => Promise<void>;
    onRowChange: (id: string, updatedRow: ExpenseDataRow) => void;
    onDelete: (id: string | number) => void;
}

/**
 * Refine data from the .csv file for saving
 */
export default function BulkImportDialog({
    open,
    loading,
    saving,
    rowOrder,
    loadedExpenses,
    importErrors,
    clearImportErrors,
    errors,
    onClose,
    onBulkSave,
    onRowChange,
    onDelete,
}: BulkImportDialogProps) {
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" disableEscapeKeyDown>
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                Bulk Import
                <IconButton aria-label="close" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />
            <DialogContent>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%',
                        height: '100%',
                        minHeight: 200,
                    }}
                >
                    {loading && <CircularProgress />}
                    {!loading && (
                        <Stack spacing={1} sx={{ width: '100%' }}>
                            {rowOrder.length == 0 && <Alert severity="error">No rows to import.</Alert>}
                            {!loading && (
                                <>
                                    <BulkImportErrors errors={importErrors} onClose={clearImportErrors} />
                                    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                                        <TableContainer sx={{ maxHeight: '70vh', overflowX: 'scroll' }}>
                                            <Table
                                                stickyHeader
                                                sx={{ tableLayout: 'fixed', maxWidth: '100%' }}
                                                aria-label="Bulk import expenses"
                                            >
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ width: '15%' }}>Date</TableCell>
                                                        <TableCell sx={{ width: '15%' }}>Amount</TableCell>
                                                        <TableCell sx={{ width: '28%' }}>Description</TableCell>
                                                        <TableCell sx={{ width: '22%' }}>Category</TableCell>
                                                        <TableCell sx={{ width: '20%' }}></TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {rowOrder.map((rowId: string) => {
                                                        const row = loadedExpenses[rowId];
                                                        return (
                                                            <BulkImportRow
                                                                key={rowId}
                                                                row={row}
                                                                rowId={rowId}
                                                                onRowChange={onRowChange}
                                                                onDelete={onDelete}
                                                                error={errors[rowId] ?? []}
                                                            />
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    </Paper>
                                </>
                            )}
                        </Stack>
                    )}
                </Box>
            </DialogContent>
            {!loading && (
                <DialogActions sx={{ px: 3, pb: 1 }}>
                    <Button disabled={loading || saving} variant="outlined" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        disabled={loading || rowOrder.length == 0}
                        loading={saving}
                        variant="outlined"
                        onClick={() => {
                            void onBulkSave();
                        }}
                    >
                        Import {rowOrder.length || ''} Rows
                    </Button>
                </DialogActions>
            )}
        </Dialog>
    );
}
