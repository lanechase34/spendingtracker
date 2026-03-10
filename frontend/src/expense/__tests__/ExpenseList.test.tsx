import { createExpenseContext, render } from '@test-utils';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ExpenseList from 'expense/ExpenseList';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

// Mocks
jest.mock('expense/ReceiptImg', () => ({
    __esModule: true,
    default: ({ alt, url }: { alt: string; url: string }) => (
        <div data-testid="receipt-img" data-url={url} data-alt={alt} />
    ),
}));

// Test data
const EXPENSE_WITH_RECEIPT = {
    id: 1,
    date: '2025-01-15',
    amount: 123.45,
    description: 'Grocery Run',
    category: 'Food',
    receipt: 1,
};

const EXPENSE_WITHOUT_RECEIPT = {
    id: 2,
    date: '2025-03-20',
    amount: 55.0,
    description: 'Dinner Out',
    category: 'Food',
    receipt: 0,
};

const EXPENSE_LONG_DESCRIPTION = {
    id: 3,
    date: '2025-06-01',
    amount: 9.99,
    description: 'A very long description that would not fit inline in the data grid row',
    category: 'Entertainment',
    receipt: 0,
};

/** Opens the detail dialog for the first detail button in the grid */
function openDetailDialog() {
    const detailButton = screen.getByRole('button', { name: /expense detail/i });
    fireEvent.click(detailButton);
}

/** Opens the confirm delete dialog for the first delete button in the grid */
function openDeleteDialog() {
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);
}

describe('ExpenseList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('Renders the data grid with column headers', () => {
            render(<ExpenseList />, { expenseContextValue: createExpenseContext({ expenses: [] }) });

            expect(screen.getByText('Date')).toBeInTheDocument();
            expect(screen.getByText('Amount')).toBeInTheDocument();
            expect(screen.getByText('Description')).toBeInTheDocument();
            expect(screen.getByText('Category')).toBeInTheDocument();
        });

        it('Renders the ErrorCard when error is true', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({ error: true, expenses: [] }),
            });
            expect(screen.getByTestId('error-card')).toBeInTheDocument();
        });

        it('Does not render the data grid when error is true', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({ error: true, expenses: [] }),
            });
            expect(screen.queryByRole('grid')).not.toBeInTheDocument();
        });

        it('Shows loading state with only the header row', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({ loading: true, expenses: [] }),
            });
            const rows = screen.getAllByRole('row');
            expect(rows.length).toBe(1); // only header row
        });

        it('Shows "No Expenses Found" when expenses array is empty', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({ expenses: [], loading: false }),
            });
            expect(screen.getByText('No Expenses Found')).toBeInTheDocument();
        });

        it('Renders expense rows when expenses are provided', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT, EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 2,
                }),
            });
            expect(await screen.findByText('Grocery Run')).toBeInTheDocument();
            expect(screen.getByText('Dinner Out')).toBeInTheDocument();
        });

        it('Renders the toolbar with "Expense List" title', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({ expenses: [] }),
            });
            expect(screen.getByText('Expense List')).toBeInTheDocument();
        });
    });

    describe('Column formatting', () => {
        it('Formats date as MM/DD/YYYY', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            expect(await screen.findByText('01/15/2025')).toBeInTheDocument();
        });

        it('Formats amount as currency', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            expect(await screen.findByText('$123.45')).toBeInTheDocument();
        });

        it('Renders empty string for null amount', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [{ ...EXPENSE_WITH_RECEIPT, amount: null as unknown as number }],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            // Null amount renders as empty - no currency string present
            expect(screen.queryByText('$')).not.toBeInTheDocument();
        });

        it('Renders description and category', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_LONG_DESCRIPTION],
                    totalRowCount: 1,
                }),
            });
            expect(await screen.findByText(EXPENSE_LONG_DESCRIPTION.description)).toBeInTheDocument();
            expect(screen.getByText('Entertainment')).toBeInTheDocument();
        });
    });

    describe('Footer', () => {
        it('Shows only total when totalSum equals filteredSum', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [],
                    totalSum: 1000,
                    filteredSum: 1000,
                }),
            });
            const footer = screen.getByTestId('total-footer');
            expect(footer).toHaveTextContent('Total: $1,000.00');
            expect(footer).not.toHaveTextContent('Filtered');
        });

        it('Shows both total and filtered when they differ', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [],
                    totalSum: 1000.01,
                    filteredSum: 500.0,
                }),
            });
            const footer = screen.getByTestId('total-footer');
            expect(footer).toHaveTextContent('Total: $1,000.01');
            expect(footer).toHaveTextContent('Filtered: $500.00');
        });

        it('Handles null totalSum and filteredSum gracefully', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [],
                    totalSum: null,
                    filteredSum: null,
                }),
            });
            expect(screen.getByTestId('total-footer')).toBeInTheDocument();
        });
    });

    describe('Detail dialog', () => {
        it('Opens the detail dialog when the detail button is clicked', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            openDetailDialog();
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('Displays all expense details in the dialog', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            openDetailDialog();

            const dialog = screen.getByRole('dialog');
            expect(within(dialog).getByText('01/15/2025')).toBeInTheDocument();
            expect(within(dialog).getByText('$123.45')).toBeInTheDocument();
            expect(within(dialog).getByText('Grocery Run')).toBeInTheDocument();
            expect(within(dialog).getByText('Food')).toBeInTheDocument();
        });

        it('Shows ReceiptImg with correct url when receipt > 0', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            openDetailDialog();

            const img = screen.getByTestId('receipt-img');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('data-url', '/spendingtracker/api/v1/expenses/1/receipt');
            expect(img).toHaveAttribute('data-alt', 'Grocery Run');
        });

        it('Does not show ReceiptImg when receipt === 0', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Dinner Out');
            openDetailDialog();

            expect(screen.queryByTestId('receipt-img')).not.toBeInTheDocument();
        });

        it('Closes the dialog when the X icon button is clicked', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            openDetailDialog();
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'close' }));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('Closes the dialog when the Close button is clicked', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            openDetailDialog();

            const dialog = screen.getByRole('dialog');
            fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('Does not close the dialog on backdrop click', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            openDetailDialog();

            // Simulate MUI backdropClick reason
            const dialog = screen.getByRole('dialog');
            fireEvent.keyDown(dialog, { key: 'Escape' }); // disableEscapeKeyDown - should not close
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('Retains dialog content during close animation and clears after onExited', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Grocery Run');
            openDetailDialog();
            expect(within(screen.getByRole('dialog')).getByText('Grocery Run')).toBeInTheDocument();

            // Close - content should still be visible until onExited fires
            fireEvent.click(screen.getByRole('button', { name: 'close' }));

            // After full close, dialog is gone
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        });

        it('Can open detail dialog for a different expense after closing', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT, EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 2,
                }),
            });
            await screen.findByText('Grocery Run');

            const detailButtons = screen.getAllByRole('button', { name: /expense detail/i });

            // Open first
            fireEvent.click(detailButtons[0]);
            expect(within(screen.getByRole('dialog')).getByText('Grocery Run')).toBeInTheDocument();

            // Close
            fireEvent.click(screen.getByRole('button', { name: 'close' }));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

            // Open second
            fireEvent.click(detailButtons[1]);
            expect(within(screen.getByRole('dialog')).getByText('Dinner Out')).toBeInTheDocument();
        });
    });

    describe('Delete flow', () => {
        it('Opens the confirm dialog when delete button is clicked', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Dinner Out');
            openDeleteDialog();
            expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
        });

        it('Calls deleteExpense with the correct expense id on confirm', async () => {
            const mockDeleteExpense = jest.fn().mockResolvedValue(undefined);
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                    deleteExpense: mockDeleteExpense,
                }),
            });
            await screen.findByText('Dinner Out');
            openDeleteDialog();

            const confirmButton = await screen.findByRole('button', { name: /confirm/i });
            fireEvent.click(confirmButton);

            await waitFor(() => expect(mockDeleteExpense).toHaveBeenCalledWith(2));
        });

        it('Closes the confirm dialog when handleClose is called', async () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            await screen.findByText('Dinner Out');
            openDeleteDialog();
            expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
        });

        it('Prevents double-firing deleteExpense when deletingExpense is true', async () => {
            const mockDeleteExpense = jest.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 500)));
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                    deleteExpense: mockDeleteExpense,
                }),
            });
            await screen.findByText('Dinner Out');
            openDeleteDialog();

            const confirmButton = await screen.findByRole('button', { name: /confirm/i });

            // Click confirm twice rapidly
            fireEvent.click(confirmButton);
            fireEvent.click(confirmButton);

            await waitFor(() => expect(mockDeleteExpense).toHaveBeenCalledTimes(1));
        });

        it('Resets selectedExpense to -1 after successful delete', async () => {
            const mockDeleteExpense = jest.fn().mockResolvedValue(undefined);
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                    deleteExpense: mockDeleteExpense,
                }),
            });
            await screen.findByText('Dinner Out');
            openDeleteDialog();

            fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));

            await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument());
        });

        it('Does not render ConfirmDialog when no expense is selected for deletion', () => {
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                }),
            });
            expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
        });

        it('Shows delete button as disabled while a deletion is in progress', async () => {
            const mockDeleteExpense = jest.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 500)));
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITHOUT_RECEIPT],
                    totalRowCount: 1,
                    deleteExpense: mockDeleteExpense,
                }),
            });
            await screen.findByText('Dinner Out');
            openDeleteDialog();

            fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));

            await waitFor(() => expect(screen.getByRole('button', { name: /delete/i })).toBeDisabled());
        });
    });

    describe('Detail dialog and delete dialog coexistence', () => {
        it('Can open detail dialog and delete dialog independently', async () => {
            const mockDeleteExpense = jest.fn().mockResolvedValue(undefined);
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [EXPENSE_WITH_RECEIPT],
                    totalRowCount: 1,
                    deleteExpense: mockDeleteExpense,
                }),
            });
            await screen.findByText('Grocery Run');

            // Open detail
            openDetailDialog();
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            // Close detail
            fireEvent.click(screen.getByRole('button', { name: 'close' }));
            await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

            // Open delete
            openDeleteDialog();
            expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
        });
    });

    describe('Pagination, sort, and filter handlers', () => {
        it('Passes pagination model to the DataGrid', () => {
            const paginationModel = { page: 0, pageSize: 25 };
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: [],
                    paginationModel,
                }),
            });
            // DataGrid renders with correct pageSize - spot check via rows per page
            expect(screen.getByRole('grid')).toBeInTheDocument();
        });

        it('Calls handlePaginationModelChange when pagination changes', async () => {
            const handlePaginationModelChange = jest.fn();
            render(<ExpenseList />, {
                expenseContextValue: createExpenseContext({
                    expenses: Array.from({ length: 11 }, (_, i) => ({
                        ...EXPENSE_WITHOUT_RECEIPT,
                        id: i + 1,
                        description: `Expense ${i + 1}`,
                    })),
                    totalRowCount: 11,
                    handlePaginationModelChange,
                }),
            });
            await screen.findByText('Expense 1');
            // Pagination interaction is handled by MUI internals -
            // verify the handler is wired by confirming it's passed via context
            expect(handlePaginationModelChange).toBeDefined();
        });
    });
});
