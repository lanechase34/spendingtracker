import { createExpenseContext, render } from '@test-utils';
import { fireEvent, screen } from '@testing-library/react';
import ExpenseList from 'expense/ExpenseList';
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });

/**
 * Mock hooks and child components
 */
jest.mock('expense/ReceiptDialog', () => ({
    __esModule: true,
    default: ({ open, title }: { open: boolean; title: string }) =>
        open ? <div data-testid="receipt-dialog">{title}</div> : null,
}));

describe('Expense List Component Test', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Renders rows and handles receipt click', async () => {
        const expenseContextValue = createExpenseContext({
            expenses: [
                {
                    id: 1,
                    date: '2025-01-01',
                    amount: 12.34,
                    description: 'Lunch',
                    category: 'Food',
                    receipt: 1,
                },
            ],
            filteredSum: 12.34,
            totalSum: 100,
            totalRowCount: 1,
        });

        render(<ExpenseList />, { expenseContextValue });
        expect(await screen.findByText('Lunch')).toBeInTheDocument();

        const receiptButton = screen.getByRole('button', { name: /receipt/i });
        fireEvent.click(receiptButton);
        expect(screen.getByTestId('receipt-dialog')).toBeInTheDocument();
    });

    it('Shows confirmation dialog on delete and calls deleteExpense', async () => {
        const mockDeleteExpense = jest.fn().mockResolvedValue(undefined);

        const expenseContextValue = createExpenseContext({
            expenses: [
                {
                    id: 2,
                    date: '2025-01-02',
                    amount: 55.0,
                    description: 'Dinner',
                    category: 'Food',
                    receipt: 0,
                },
            ],
            filteredSum: 55.0,
            totalSum: 55.0,
            totalRowCount: 1,
            deleteExpense: mockDeleteExpense,
        });

        render(<ExpenseList />, { expenseContextValue });

        const deleteButton = await screen.findByRole('button', { name: /delete/i });
        fireEvent.click(deleteButton);
        expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();

        // Confirm the deletion
        const confirmButton = await screen.findByRole('button', {
            name: /confirm/i,
        });
        fireEvent.click(confirmButton);

        // Wait for async operation
        // Should still be open while deleting
        await screen.findByTestId('confirm-dialog');

        expect(mockDeleteExpense).toHaveBeenCalledWith(2);
    });

    it('Renders error card when error is true', () => {
        const expenseContextValue = createExpenseContext({
            error: true,
            expenses: [],
        });

        render(<ExpenseList />, { expenseContextValue });
        expect(screen.getByTestId('error-card')).toBeInTheDocument();
    });

    it('Shows loading state', () => {
        const expenseContextValue = createExpenseContext({
            loading: true,
            expenses: [],
        });
        render(<ExpenseList />, { expenseContextValue });

        const rows = screen.getAllByRole('row');
        expect(rows.length).toBe(1); // only header row when loading
    });

    it('Shows "No Expenses Found" when no data', () => {
        const expenseContextValue = createExpenseContext({
            expenses: [],
            loading: false,
        });
        render(<ExpenseList />, { expenseContextValue });

        expect(screen.getByText('No Expenses Found')).toBeInTheDocument();
    });

    it('Displays formatted dates and amounts', async () => {
        const expenseContextValue = createExpenseContext({
            expenses: [
                {
                    id: 3,
                    date: '2025-01-15',
                    amount: 123.45,
                    description: 'Test Expense',
                    category: 'Shopping',
                    receipt: 0,
                },
            ],
            totalRowCount: 1,
        });

        render(<ExpenseList />, { expenseContextValue });

        expect(await screen.findByText('Test Expense')).toBeInTheDocument();
        expect(screen.getByText('$123.45')).toBeInTheDocument();
        expect(screen.getByText(/1\/15\/2025/)).toBeInTheDocument();
    });

    it('Displays total sum in footer', () => {
        const expenseContextValue = createExpenseContext({
            expenses: [],
            totalSum: 1000, // total == filtered - only total will show
            filteredSum: 1000,
        });
        render(<ExpenseList />, { expenseContextValue });

        const footer = screen.getByTestId('total-footer');
        expect(footer).toHaveTextContent('Total: $1,000.00');
        expect(footer).not.toHaveTextContent('Filtered: $,1000.00');
    });

    it('Displays total and filtered sum in footer', () => {
        const expenseContextValue = createExpenseContext({
            expenses: [],
            totalSum: 1000.01, // total != filtered - both will show
            filteredSum: 1000,
        });
        render(<ExpenseList />, { expenseContextValue });

        const footer = screen.getByTestId('total-footer');
        expect(footer).toHaveTextContent('Total: $1,000.01');
        expect(footer).toHaveTextContent('Filtered: $1,000.00');
    });
});
