import { QueryClient } from '@tanstack/react-query';
import { createExpenseContext, render } from '@test-utils';
import { screen } from '@testing-library/react';
import dayjs from 'dayjs';
import useCurrencyFormatter from 'hooks/useCurrencyFormatter';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useFetchIncome } from 'hooks/useIncomeQuery';
import IncomeViewer from 'widgets/IncomeViewer';

/**
 * Mock hooks and child components
 */
jest.mock('hooks/useDateRangeContext');
jest.mock('hooks/useIncomeQuery');
jest.mock('hooks/useCurrencyFormatter');
jest.mock('components/LoadingCard', () => () => <div data-testid="loading-card" />);
jest.mock('components/ErrorCard', () => () => <div data-testid="error-card" />);
jest.mock('widgets/EditIncome', () => ({ date }: { date: dayjs.Dayjs }) => (
    <div data-testid="edit-income" data-date={date.format('YYYY-MM-DD')} />
));

const mockUseFetchIncome = useFetchIncome as jest.Mock;
const mockUseFormatCurrency = useCurrencyFormatter as jest.Mock;
const mockUseDateRangeContext = useDateRangeContext as jest.Mock;

/**
 * Mock functions
 */
const mockFormatCurrency = jest.fn((v: number) => `$${v.toFixed(2)}`);

describe('IncomeViewer Component', () => {
    let queryClient: QueryClient;
    const baseDate = dayjs('2025-01-01');

    beforeEach(() => {
        jest.clearAllMocks();

        // Create fresh QueryClient for each test
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                },
            },
        });

        mockUseFormatCurrency.mockReturnValue({
            formatCurrency: mockFormatCurrency,
        });

        mockUseDateRangeContext.mockReturnValue({
            startDate: baseDate,
            shortFormattedStartDate: '2025-01',
            shortFormattedEndDate: '2025-01',
        });

        mockUseFetchIncome.mockReturnValue({
            data: { pay: 3000, extra: 500 },
            isLoading: false,
            isError: false,
        });

        jest.spyOn(console, 'error').mockImplementation(() => {
            /*empty*/
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        queryClient.clear();
    });

    describe('Loading and error states', () => {
        it('Renders LoadingCard while loading', () => {
            mockUseFetchIncome.mockReturnValue({
                data: undefined,
                isLoading: true,
                isError: false,
            });

            render(<IncomeViewer />, { queryClient });

            expect(mockUseFetchIncome).toHaveBeenCalledWith({
                startDate: '2025-01',
                endDate: '2025-01',
            });
            expect(screen.getByTestId('loading-card')).toBeInTheDocument();
        });

        it('Renders ErrorCard when there is an error', () => {
            mockUseFetchIncome.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: true,
            });

            render(<IncomeViewer />, { queryClient });
            expect(screen.getByTestId('error-card')).toBeInTheDocument();
        });

        it('Renders ErrorCard when data is null', () => {
            mockUseFetchIncome.mockReturnValue({
                data: null,
                isLoading: false,
                isError: false,
            });

            render(<IncomeViewer />, { queryClient });
            expect(screen.getByTestId('error-card')).toBeInTheDocument();
        });

        it('Renders ErrorCard when data is undefined', () => {
            mockUseFetchIncome.mockReturnValue({
                data: undefined,
                isLoading: false,
                isError: false,
            });

            render(<IncomeViewer />, { queryClient });
            expect(screen.getByTestId('error-card')).toBeInTheDocument();
        });
    });

    describe('Income display', () => {
        it('Renders correct income, expenses, and net when data is valid', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 3000, extra: 500 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 500,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Check headers are present
            expect(screen.getByText('Net Income')).toBeInTheDocument();
            expect(screen.getByText('Income')).toBeInTheDocument();
            expect(screen.getByText('Expenses')).toBeInTheDocument();
            expect(screen.getByText('Net')).toBeInTheDocument();

            // Verify formatCurrency was called with correct values
            expect(mockFormatCurrency).toHaveBeenCalledWith(3500); // Total income (3000 + 500)
            expect(mockFormatCurrency).toHaveBeenCalledWith(500); // Expenses
            expect(mockFormatCurrency).toHaveBeenCalledWith(3000); // Net (3500 - 500)
        });

        it('Calculates total income correctly from pay and extra', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 4500, extra: 1200 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 0,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Total income should be 5700
            expect(mockFormatCurrency).toHaveBeenCalledWith(5700);
        });

        it('Handles zero income correctly', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 0, extra: 0 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 100,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            expect(mockFormatCurrency).toHaveBeenCalledWith(0); // Total income
            expect(mockFormatCurrency).toHaveBeenCalledWith(100); // Expenses
            expect(mockFormatCurrency).toHaveBeenCalledWith(100); // Net (negative, but absolute value)
        });
    });

    describe('Expense handling', () => {
        it('Handles null totalSum from expense context', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 1000, extra: 500 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: null,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Should default to 0 for expenses
            expect(mockFormatCurrency).toHaveBeenCalledWith(0); // Expenses
            expect(mockFormatCurrency).toHaveBeenCalledWith(1500); // Total income
            expect(mockFormatCurrency).toHaveBeenCalledWith(1500); // Net (1500 - 0)
        });

        it('Handles undefined totalSum from expense context', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 2000, extra: 0 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: undefined as unknown as number,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            expect(mockFormatCurrency).toHaveBeenCalledWith(0); // Expenses default to 0
            expect(mockFormatCurrency).toHaveBeenCalledWith(2000); // Net
        });
    });

    describe('Net calculation and display', () => {
        it('Shows positive net when income exceeds expenses', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 5000, extra: 1000 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 2000,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Net should be positive: 6000 - 2000 = 4000
            expect(screen.getByText('$4000.00')).toBeInTheDocument();
            // Should not have negative sign
            expect(screen.queryByText('-$4000.00')).not.toBeInTheDocument();
        });

        it('Shows negative net when expenses exceed income', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 200, extra: 100 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 500,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Net should be negative: 300 - 500 = -200
            expect(screen.getByText('-$200.00')).toBeInTheDocument();
        });

        it('Shows zero net when income equals expenses', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 3000, extra: 0 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 3000,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Net should be zero
            expect(screen.getByText('$0.00')).toBeInTheDocument();
            // Should not have negative sign for zero
            expect(screen.queryByText('-$0.00')).not.toBeInTheDocument();
        });

        it('Applies correct color styling for positive net', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 5000, extra: 0 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 1000,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Find the net typography element
            const netValue = screen.getByText('$4000.00');

            // Check for the actual computed color value (MUI success.main)
            expect(netValue).toHaveStyle({ color: 'rgb(46, 125, 50)' });
        });

        it('Applies correct color styling for negative net', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 500, extra: 0 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 1000,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Find the net typography element
            const netValue = screen.getByText('-$500.00');

            // Check for the actual computed color value (MUI error.main)
            expect(netValue).toHaveStyle({ color: 'rgb(211, 47, 47)' });
        });

        it('Calculates net correctly with various scenarios', () => {
            const testCases = [
                { income: { pay: 5000, extra: 1000 }, expenses: 2000, expectedNet: 4000, isPositive: true },
                { income: { pay: 3000, extra: 0 }, expenses: 3000, expectedNet: 0, isPositive: true },
                { income: { pay: 1000, extra: 500 }, expenses: 2000, expectedNet: 500, isPositive: false },
                { income: { pay: 10000, extra: 2000 }, expenses: 5000, expectedNet: 7000, isPositive: true },
            ];

            testCases.forEach(({ income, expenses, expectedNet, isPositive }) => {
                jest.clearAllMocks();

                mockUseFetchIncome.mockReturnValue({
                    data: income,
                    isLoading: false,
                    isError: false,
                });

                const expenseContextValue = createExpenseContext({
                    totalSum: expenses,
                });

                const { unmount } = render(<IncomeViewer />, { expenseContextValue, queryClient });

                // Verify absolute value is formatted
                expect(mockFormatCurrency).toHaveBeenCalledWith(expectedNet);

                // Verify correct display based on positive/negative/zero
                if (isPositive) {
                    expect(screen.queryByText(`$${expectedNet}.00`)).toBeInTheDocument();
                } else {
                    expect(screen.getByText(`-$${expectedNet}.00`)).toBeInTheDocument();
                }

                unmount();
            });
        });
    });

    describe('EditIncome integration', () => {
        it('Renders EditIncome component with correct date', () => {
            render(<IncomeViewer />, { queryClient });

            const editIncome = screen.getByTestId('edit-income');
            expect(editIncome).toBeInTheDocument();
            expect(editIncome).toHaveAttribute('data-date', baseDate.format('YYYY-MM-DD'));
        });

        it('Passes startDate from date range context to EditIncome', () => {
            const customDate = dayjs('2026-03-15');

            mockUseDateRangeContext.mockReturnValue({
                startDate: customDate,
                shortFormattedStartDate: '2026-03',
                shortFormattedEndDate: '2026-03',
            });

            render(<IncomeViewer />, { queryClient });

            const editIncome = screen.getByTestId('edit-income');
            expect(editIncome).toHaveAttribute('data-date', customDate.format('YYYY-MM-DD'));
        });
    });

    describe('Date range changes', () => {
        it('Calls useFetchIncome with correct date range', () => {
            mockUseDateRangeContext.mockReturnValue({
                startDate: baseDate,
                shortFormattedStartDate: '2025-01',
                shortFormattedEndDate: '2025-03',
            });

            render(<IncomeViewer />, { queryClient });

            expect(mockUseFetchIncome).toHaveBeenCalledWith({
                startDate: '2025-01',
                endDate: '2025-03',
            });
        });

        it('Updates when date range changes', () => {
            const { rerender } = render(<IncomeViewer />, { queryClient });

            // Change date range
            mockUseDateRangeContext.mockReturnValue({
                startDate: dayjs('2025-02-01'),
                shortFormattedStartDate: '2025-02',
                shortFormattedEndDate: '2025-04',
            });

            mockUseFetchIncome.mockReturnValue({
                data: { pay: 2000, extra: 200 },
                isLoading: false,
                isError: false,
            });

            rerender(<IncomeViewer />);

            expect(mockUseFetchIncome).toHaveBeenCalledWith({
                startDate: '2025-02',
                endDate: '2025-04',
            });

            // Verify new totals are calculated
            expect(mockFormatCurrency).toHaveBeenCalledWith(2200);
        });

        it('Handles single month range', () => {
            mockUseDateRangeContext.mockReturnValue({
                startDate: baseDate,
                shortFormattedStartDate: '2025-06',
                shortFormattedEndDate: '2025-06',
            });

            render(<IncomeViewer />, { queryClient });

            expect(mockUseFetchIncome).toHaveBeenCalledWith({
                startDate: '2025-06',
                endDate: '2025-06',
            });
        });

        it('Handles multi-month range', () => {
            mockUseDateRangeContext.mockReturnValue({
                startDate: baseDate,
                shortFormattedStartDate: '2025-01',
                shortFormattedEndDate: '2025-12',
            });

            render(<IncomeViewer />, { queryClient });

            expect(mockUseFetchIncome).toHaveBeenCalledWith({
                startDate: '2025-01',
                endDate: '2025-12',
            });
        });
    });

    describe('Typography and layout', () => {
        it('Renders all card sections', () => {
            render(<IncomeViewer />, { queryClient });

            // Check all three cards are present
            expect(screen.getByText('Income')).toBeInTheDocument();
            expect(screen.getByText('Expenses')).toBeInTheDocument();
            expect(screen.getByText('Net')).toBeInTheDocument();
        });

        it('Displays income with success color', () => {
            render(<IncomeViewer />, { queryClient });

            const incomeValues = screen.getAllByText('$3500.00');

            incomeValues.forEach((incomeValue) => {
                // Check for the actual computed color value (MUI success.main)
                expect(incomeValue).toHaveStyle({ color: 'rgb(46, 125, 50)' });
            });
        });

        it('Displays expenses with error color and negative sign', () => {
            const expenseContextValue = createExpenseContext({
                totalSum: 1000,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            const expensesText = screen.getByText(/-\$1000\.00/);
            expect(expensesText).toBeInTheDocument();

            // Check for the actual computed color value (MUI error.main)
            expect(expensesText).toHaveStyle({ color: 'rgb(211, 47, 47)' });
        });

        it('Renders Net Income title in header', () => {
            render(<IncomeViewer />, { queryClient });

            const title = screen.getByText('Net Income');
            expect(title).toBeInTheDocument();
        });
    });

    describe('Edge cases', () => {
        it('Handles very large income values', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 1000000, extra: 500000 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 100000,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            expect(mockFormatCurrency).toHaveBeenCalledWith(1500000); // Total income
            expect(mockFormatCurrency).toHaveBeenCalledWith(1400000); // Net
        });

        it('Handles decimal values correctly', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 3500.5, extra: 250.25 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 1000.75,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Total: 3750.75, Net: 2750.00
            expect(mockFormatCurrency).toHaveBeenCalledWith(3750.75);
            expect(mockFormatCurrency).toHaveBeenCalledWith(2750);
        });

        it('Handles negative pay values (debt/refund scenarios)', () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: -500, extra: 100 },
                isLoading: false,
                isError: false,
            });

            const expenseContextValue = createExpenseContext({
                totalSum: 0,
            });

            render(<IncomeViewer />, { expenseContextValue, queryClient });

            // Total income would be -400
            expect(mockFormatCurrency).toHaveBeenCalledWith(-400);
        });
    });
});
