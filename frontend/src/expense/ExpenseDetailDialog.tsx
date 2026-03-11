import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import DetailRow from 'components/DetailRow';
import dayjs from 'dayjs';
import useCurrencyFormatter from 'hooks/useCurrencyFormatter';
import type { Expense } from 'types/Expense.type';

import ReceiptImg from './ReceiptImg';

interface ExpenseDetailDialogProps {
    open: boolean;
    expense: Expense | null;
    onClose: () => void;
    onExited?: () => void;
}

/**
 * Displays the full details of a selected expense in a modal dialog.
 *
 * Behaviour
 * - Renders expense fields (date, amount, description, category) as labeled rows.
 * - If the expense has a receipt, renders it below the detail rows via {ReceiptImg}.
 * - Clears the selected expense only after the close transition completes,
 *   preventing a content flash during the exit animation.
 */
export default function ExpenseDetailDialog({ open, expense, onClose, onExited }: ExpenseDetailDialogProps) {
    const { formatCurrency } = useCurrencyFormatter({});

    return (
        <Dialog
            open={open}
            onClose={(_event: object, reason: string) => {
                if (reason !== 'backdropClick') onClose();
            }}
            slotProps={{
                transition: {
                    onExited,
                },
            }}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                Details
                <IconButton aria-label="close" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                {expense && (
                    <Stack spacing={1}>
                        <DetailRow label="Date" value={dayjs(expense.date).format('MM/DD/YYYY')} />
                        <DetailRow label="Amount" value={formatCurrency(expense.amount)} />
                        <DetailRow label="Description" value={expense.description} multiline />
                        <DetailRow label="Category" value={expense.category} />

                        {expense.receipt > 0 && (
                            <ReceiptImg
                                alt={expense.description}
                                url={`/spendingtracker/api/v1/expenses/${expense.id}/receipt`}
                            />
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions sx={{ px: 3 }}>
                <Button variant="outlined" onClick={onClose}>
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}
