import { QueryClient } from '@tanstack/react-query';
import { render } from '@test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import useFormField from 'hooks/useFormField';
import { useFetchIncome, useUpdateIncome } from 'hooks/useIncomeQuery';
import EditIncome from 'widgets/EditIncome';

/**
 * Mock hooks and child components
 */
jest.mock('hooks/useIncomeQuery');
jest.mock('hooks/useFormField');
jest.mock('components/EndAdornmentLoading', () => () => <div data-testid="loading-spinner" />);

const mockUseFetchIncome = useFetchIncome as jest.Mock;
const mockUseUpdateIncome = useUpdateIncome as jest.Mock;
const mockUseFormField = useFormField as jest.Mock;

/**
 * Mock MUI Datepicker for simplicity
 */
jest.mock('@mui/x-date-pickers/DatePicker', () => ({
    DatePicker: ({
        value,
        onChange,
        label,
        onError,
    }: {
        value: Dayjs;
        onChange: (val: Dayjs | null) => void;
        label: string;
        onError: (error: string | null) => void;
    }) => (
        <input
            aria-label={label}
            value={value.format('YYYY-MM')}
            onChange={(e) => {
                const newVal = e.target.value ? dayjs(e.target.value) : null;
                if (newVal && !newVal.isValid()) {
                    onError('invalidDate');
                } else {
                    onError(null);
                }
                onChange(newVal);
            }}
        />
    ),
}));

describe('<EditIncome />', () => {
    let queryClient: QueryClient;
    let mockMutateAsync: jest.Mock;

    const mockNumberField = {
        value: '1000',
        error: null,
        handleChange: jest.fn(),
        handleBlur: jest.fn(),
        setValue: jest.fn(),
        validateField: jest.fn(() => null),
        reset: jest.fn(),
    };

    const baseDate = dayjs('2025-01-01');

    beforeEach(() => {
        jest.clearAllMocks();

        // Create a new QueryClient for each test
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                },
            },
        });

        mockMutateAsync = jest.fn().mockResolvedValue({});

        mockUseUpdateIncome.mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: false,
        });

        mockUseFetchIncome.mockReturnValue({
            data: { pay: 1100, extra: 210 },
            isLoading: false,
            isError: false,
        });

        mockUseFormField.mockImplementation(() => ({
            ...mockNumberField,
            value: '',
        }));

        jest.spyOn(console, 'error').mockImplementation(() => {
            /*empty*/
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        queryClient.clear();
    });

    describe('Dialog open/close behavior', () => {
        it('Renders edit button and opens dialog on click', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            const editBtn = screen.getByLabelText(/edit/i);
            expect(editBtn).toBeInTheDocument();

            fireEvent.click(editBtn);

            expect(await screen.findByText(/edit income/i)).toBeInTheDocument();

            // Verify useFetchIncome was called with enabled: true after opening
            await waitFor(() => {
                expect(mockUseFetchIncome).toHaveBeenCalledWith({
                    startDate: baseDate.format('YYYY-MM'),
                    endDate: baseDate.format('YYYY-MM'),
                    enabled: true,
                });
            });
        });

        it('Fetches income data only when dialog is open (enabled: false initially)', () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            // Before opening, enabled should be false
            expect(mockUseFetchIncome).toHaveBeenCalledWith({
                startDate: baseDate.format('YYYY-MM'),
                endDate: baseDate.format('YYYY-MM'),
                enabled: false,
            });
        });

        it('Closes dialog when close button clicked', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const closeBtn = await screen.findByLabelText(/close/i);
            fireEvent.click(closeBtn);

            await waitFor(() => {
                expect(screen.queryByText(/edit income/i)).not.toBeInTheDocument();
            });
        });

        it('Closes dialog when Close button in footer clicked', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const closeBtn = await screen.findByLabelText(/close/i);
            fireEvent.click(closeBtn);

            await waitFor(() => {
                expect(screen.queryByText(/edit income/i)).not.toBeInTheDocument();
            });
        });

        it('Prevents closing with backdrop click', () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const dialog = screen.getByRole('dialog');

            // Simulate backdrop click
            fireEvent.click(dialog.parentElement!);

            // Dialog should still be open
            expect(screen.getByText(/edit income/i)).toBeInTheDocument();
        });

        it('Prevents closing with backdrop click during form submission', async () => {
            mockMutateAsync.mockImplementation(
                () =>
                    new Promise(() => {
                        /*empty*/
                    })
            ); // Never resolves

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalled();
            });

            // Try to close with backdrop
            const dialog = screen.getByRole('dialog');
            fireEvent.click(dialog.parentElement!);

            // Should still be open
            expect(screen.getByText(/edit income/i)).toBeInTheDocument();
        });

        it('Resets selected date to parent date when opening', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const dateInput = await screen.findByLabelText(/date/i);
            expect(dateInput).toHaveValue(baseDate.format('YYYY-MM'));

            // Change date
            const newDate = baseDate.add(1, 'month');
            fireEvent.change(dateInput, { target: { value: newDate.format('YYYY-MM') } });

            // Close dialog
            const closeBtn = await screen.findByLabelText(/close/i);
            fireEvent.click(closeBtn);

            await waitFor(() => {
                expect(screen.queryByText(/edit income/i)).not.toBeInTheDocument();
            });

            // Reopen - should reset to parent date
            fireEvent.click(screen.getByLabelText(/edit/i));

            await waitFor(() => {
                const dateInputReopened = screen.getByLabelText(/date/i);
                expect(dateInputReopened).toHaveValue(baseDate.format('YYYY-MM'));
            });
        });

        it('Clears form loading state on dialog exit', async () => {
            mockMutateAsync.mockResolvedValue({});

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalled();
            });

            // Dialog closes automatically on success
            await waitFor(() => {
                expect(screen.queryByText(/edit income/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Form field population from fetched data', () => {
        it('Populates form fields with fetched income data', async () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 5000, extra: 500 },
                isLoading: false,
                isError: false,
            });

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            await waitFor(() => {
                expect(mockNumberField.setValue).toHaveBeenCalledWith('5000');
                expect(mockNumberField.setValue).toHaveBeenCalledWith('500');
            });
        });

        it('Handles missing income data gracefully', async () => {
            mockUseFetchIncome.mockReturnValue({
                data: { pay: undefined, extra: undefined },
                isLoading: false,
                isError: false,
            });

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            await waitFor(() => {
                expect(mockNumberField.setValue).toHaveBeenCalledWith('0');
            });
        });

        it('Updates form fields when date changes and new data loads', async () => {
            const { rerender } = render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            // Initial data
            await waitFor(() => {
                expect(mockNumberField.setValue).toHaveBeenCalledWith('1100');
            });

            mockNumberField.setValue.mockClear();

            // Change date
            const dateInput = screen.getByLabelText(/date/i);
            const newDate = baseDate.add(1, 'month');
            fireEvent.change(dateInput, { target: { value: newDate.format('YYYY-MM') } });

            // Mock new data for new month
            mockUseFetchIncome.mockReturnValue({
                data: { pay: 6000, extra: 600 },
                isLoading: false,
                isError: false,
            });

            rerender(<EditIncome date={baseDate} />);

            await waitFor(() => {
                expect(mockNumberField.setValue).toHaveBeenCalledWith('6000');
                expect(mockNumberField.setValue).toHaveBeenCalledWith('600');
            });
        });
    });

    describe('Form validation', () => {
        it('Validates all fields on submit', async () => {
            const validateSpy = jest.fn(() => null);
            mockUseFormField.mockImplementation(() => ({
                ...mockNumberField,
                validateField: validateSpy,
            }));

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                // Called twice: once for pay, once for extra
                expect(validateSpy).toHaveBeenCalledTimes(2);
            });
        });

        it('Prevents submission when validation fails', async () => {
            const validateSpy = jest.fn(() => 'Field is required');
            mockUseFormField.mockImplementation(() => ({
                ...mockNumberField,
                value: '',
                validateField: validateSpy,
            }));

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(validateSpy).toHaveBeenCalled();
            });

            // Mutation should not be called
            expect(mockMutateAsync).not.toHaveBeenCalled();
        });

        it('Prevents submission with invalid date', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const dateInput = await screen.findByLabelText(/date/i);
            fireEvent.change(dateInput, { target: { value: 'invalid' } });

            const updateBtn = screen.getByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            // Mutation should not be called
            expect(mockMutateAsync).not.toHaveBeenCalled();
        });

        it('Prevents double submission', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });

            // Click twice rapidly
            fireEvent.click(updateBtn);
            fireEvent.click(updateBtn);

            await waitFor(() => {
                // Should only be called once
                expect(mockMutateAsync).toHaveBeenCalledTimes(1);
            });
        });
    });

    describe('Form submission', () => {
        it('Submits with correct data format', async () => {
            mockUseFormField.mockImplementation(() => ({
                ...mockNumberField,
                value: '5000',
                validateField: jest.fn(() => null),
            }));

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalledWith({
                    date: baseDate.format('YYYY-MM'),
                    pay: '5000',
                    extra: '5000',
                });
            });
        });

        it('Closes dialog on successful submission', async () => {
            mockMutateAsync.mockResolvedValue({});

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(screen.queryByText(/edit income/i)).not.toBeInTheDocument();
            });
        });

        it('Displays error message on submission failure', async () => {
            mockMutateAsync.mockRejectedValue(new Error('Network error'));

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(screen.getByText(/network error/i)).toBeInTheDocument();
            });

            // Dialog should still be open
            expect(screen.getByText(/edit income/i)).toBeInTheDocument();
        });

        it('Displays generic error message when error has no message', async () => {
            mockMutateAsync.mockRejectedValue({});

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(screen.getByText(/error. please try again/i)).toBeInTheDocument();
            });
        });

        it('Can dismiss form error alert', async () => {
            mockMutateAsync.mockRejectedValue(new Error('Test error'));

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            const errorAlert = await screen.findByText(/test error/i);
            expect(errorAlert).toBeInTheDocument();

            // Find and click close button on alert
            const alertCloseBtn = errorAlert.closest('.MuiAlert-root')?.querySelector('button');
            if (alertCloseBtn) {
                fireEvent.click(alertCloseBtn);
            }

            await waitFor(() => {
                expect(screen.queryByText(/test error/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Loading states', () => {
        it('Disables form inputs while fetching data', async () => {
            mockUseFetchIncome.mockReturnValue({
                data: null,
                isLoading: true,
                isError: false,
            });

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const payInput = await screen.findByLabelText(/pay/i);
            const extraInput = screen.getByLabelText(/extra/i);

            expect(payInput).toBeDisabled();
            expect(extraInput).toBeDisabled();
        });

        it('Disables update button while fetching data', async () => {
            mockUseFetchIncome.mockReturnValue({
                data: null,
                isLoading: true,
                isError: false,
            });

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            expect(updateBtn).toBeDisabled();
        });

        it('Disables update button while submitting', async () => {
            mockMutateAsync.mockImplementation(
                () =>
                    new Promise(() => {
                        /*empty*/
                    })
            ); // Never resolves

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(updateBtn).toBeDisabled();
            });
        });

        it('Shows loading spinners in input fields while fetching', async () => {
            mockUseFetchIncome.mockReturnValue({
                data: null,
                isLoading: true,
                isError: false,
            });

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            await waitFor(() => {
                // Two loading spinners: one for pay, one for extra
                expect(screen.getAllByTestId('loading-spinner')).toHaveLength(2);
            });
        });
    });

    describe('Error handling', () => {
        it('Displays error when income fetch fails', async () => {
            mockUseFetchIncome.mockReturnValue({
                data: null,
                isLoading: false,
                isError: true,
            });

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            expect(await screen.findByText(/failed to load income data/i)).toBeInTheDocument();
        });

        it('Prioritizes form error over fetch error', async () => {
            mockUseFetchIncome.mockReturnValue({
                data: null,
                isLoading: false,
                isError: true,
            });

            mockMutateAsync.mockRejectedValue(new Error('Submit failed'));

            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const updateBtn = await screen.findByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                // Should show submit error, not fetch error
                expect(screen.getByText(/submit failed/i)).toBeInTheDocument();
                expect(screen.queryByText(/failed to load income data/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Date picker behavior', () => {
        it('Changes selected date and refetches income data', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const dateInput = await screen.findByLabelText(/date/i);
            const newDate = baseDate.add(1, 'month');

            fireEvent.change(dateInput, { target: { value: newDate.format('YYYY-MM') } });

            await waitFor(() => {
                expect(mockUseFetchIncome).toHaveBeenCalledWith({
                    startDate: newDate.format('YYYY-MM'),
                    endDate: newDate.format('YYYY-MM'),
                    enabled: true,
                });
            });
        });

        it('Submits with selected date, not parent date', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const dateInput = await screen.findByLabelText(/date/i);
            const newDate = baseDate.add(2, 'months');

            fireEvent.change(dateInput as HTMLInputElement, { target: { value: newDate.format('YYYY-MM') } });

            const updateBtn = screen.getByRole('button', { name: /update/i });
            fireEvent.click(updateBtn);

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalledWith({
                    date: newDate.format('YYYY-MM'),
                    pay: expect.any(String) as unknown,
                    extra: expect.any(String) as unknown,
                });
            });
        });

        it('Handles null date picker value', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            fireEvent.click(screen.getByLabelText(/edit/i));

            const dateInput = await screen.findByLabelText(/date/i);

            // Simulate clearing the date (onChange receives null)
            fireEvent.change(dateInput, { target: { value: '' } });

            // Date should remain unchanged (null is ignored)
            expect(dateInput).toHaveValue(baseDate.format('YYYY-MM'));
        });
    });
});
