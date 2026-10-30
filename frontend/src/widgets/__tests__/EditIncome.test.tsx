import { QueryClient } from '@tanstack/react-query';
import { render } from '@test-utils';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useFetchExtraIncome, useFetchIncome, useSaveIncomeChanges } from 'hooks/useIncomeQuery';
import type { IncomeExtra } from 'types/Income.type';
import { BASE_FORMAT } from 'utils/dates';
import EditIncome from 'widgets/EditIncome';

/**
 * Mock hooks and child components
 */
jest.mock('hooks/useIncomeQuery');
jest.mock('components/EndAdornmentLoading', () => () => <div data-testid="loading-spinner" />);

const mockUseFetchIncome = useFetchIncome as jest.Mock;
const mockUseFetchExtraIncome = useFetchExtraIncome as jest.Mock;
const mockUseSaveIncomeChanges = useSaveIncomeChanges as jest.Mock;

/**
 * Mock MUI Datepicker for simplicity
 */
jest.mock('@mui/x-date-pickers/DatePicker', () => ({
    DatePicker: ({
        value,
        onChange,
        label,
        onError,
        disabled,
    }: {
        value: Dayjs;
        onChange: (val: Dayjs | null) => void;
        label: string;
        onError: (error: string | null) => void;
        disabled?: boolean;
    }) => (
        <input
            aria-label={label}
            value={value.format(BASE_FORMAT)}
            disabled={disabled}
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

const savedExtras: IncomeExtra[] = [
    { id: 1, date: '2025-01-20', amount: 200, description: 'Bonus' },
    { id: 2, date: '2025-01-05', amount: 100.5, description: 'Gift' },
];

const noFailures = { payFailed: false, failedAdds: [], failedRemovals: [] };

describe('<EditIncome />', () => {
    let queryClient: QueryClient;
    let mockMutateAsync: jest.Mock;

    const baseDate = dayjs('01-01-2025');

    async function openDialog(date: Dayjs = baseDate) {
        const view = render(<EditIncome date={date} />, { queryClient });
        fireEvent.click(screen.getByLabelText('edit'));
        await screen.findByText('Edit Income');
        return view;
    }

    const payInput = () => screen.getByLabelText(/^pay/i);
    const extraInput = () => screen.getByLabelText('Extra');
    const amountInput = () => screen.getByLabelText(/^amount/i);
    const descriptionInput = () => screen.getByLabelText(/^description/i);
    const updateButton = () => screen.getByRole('button', { name: /update/i });
    const entryList = () => screen.getByRole('list', { name: /extra income entries/i });

    function addEntry(amount: string, description: string, date?: string) {
        if (date !== undefined) {
            fireEvent.change(screen.getByLabelText('Date Received'), { target: { value: date } });
        }
        fireEvent.change(amountInput(), { target: { value: amount } });
        fireEvent.change(descriptionInput(), { target: { value: description } });
        fireEvent.click(screen.getByRole('button', { name: /add/i }));
    }

    beforeEach(() => {
        jest.clearAllMocks();

        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    gcTime: 0,
                },
            },
        });

        mockMutateAsync = jest.fn().mockResolvedValue(noFailures);

        mockUseSaveIncomeChanges.mockReturnValue({
            mutateAsync: mockMutateAsync,
            isPending: false,
            isError: false,
        });

        mockUseFetchIncome.mockReturnValue({
            data: { pay: 1100, extra: 300.5 },
            isLoading: false,
            isError: false,
        });

        mockUseFetchExtraIncome.mockReturnValue({
            data: savedExtras,
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

    describe('Dialog open/close behavior', () => {
        it('Only fetches income and extra income once the dialog is open', async () => {
            render(<EditIncome date={baseDate} />, { queryClient });

            const params = { startDate: baseDate.format(BASE_FORMAT), endDate: baseDate.format(BASE_FORMAT) };
            expect(mockUseFetchIncome).toHaveBeenLastCalledWith({ ...params, enabled: false });
            expect(mockUseFetchExtraIncome).toHaveBeenLastCalledWith({ ...params, enabled: false });

            fireEvent.click(screen.getByLabelText('edit'));
            expect(await screen.findByText('Edit Income')).toBeInTheDocument();

            expect(mockUseFetchIncome).toHaveBeenLastCalledWith({ ...params, enabled: true });
            expect(mockUseFetchExtraIncome).toHaveBeenLastCalledWith({ ...params, enabled: true });
        });

        it.each([['close'], ['Close']])('Closes the dialog from the %s button', async (name) => {
            await openDialog();

            fireEvent.click(screen.getByRole('button', { name }));

            await waitFor(() => {
                expect(screen.queryByText('Edit Income')).not.toBeInTheDocument();
            });
        });

        it('Ignores escape key presses', async () => {
            await openDialog();

            fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

            expect(screen.getByText('Edit Income')).toBeInTheDocument();
        });

        it('Resets the month to the parent date and discards staged changes when reopening', async () => {
            await openDialog();

            fireEvent.change(await screen.findByLabelText('Month'), { target: { value: '03-01-2025' } });
            fireEvent.click(screen.getByRole('button', { name: 'Close' }));
            await waitFor(() => {
                expect(screen.queryByText('Edit Income')).not.toBeInTheDocument();
            });

            fireEvent.click(screen.getByLabelText('edit'));
            expect(await screen.findByLabelText('Month')).toHaveValue('01-01-2025');
        });
    });

    describe('Populating from fetched data', () => {
        it('Pre-fills pay, shows the extra total and lists the extra entries newest first', async () => {
            await openDialog();

            expect(payInput()).toHaveValue('1100');
            expect(extraInput()).toHaveValue('300.50');

            const rows = within(entryList()).getAllByRole('listitem');
            expect(rows).toHaveLength(2);
            expect(rows[0]).toHaveTextContent('Bonus');
            expect(rows[0]).toHaveTextContent('Jan 20, 2025 · $200.00');
            expect(rows[1]).toHaveTextContent('Gift');
            expect(rows[1]).toHaveTextContent('Jan 5, 2025 · $100.50');
        });

        it('Shows an empty state when the month has no extra income', async () => {
            mockUseFetchExtraIncome.mockReturnValue({ data: [], isLoading: false, isError: false });
            await openDialog();

            expect(screen.getByText('No extra income this month')).toBeInTheDocument();
            expect(extraInput()).toHaveValue('0.00');
        });

        it('Keeps the extra total read only', async () => {
            await openDialog();

            expect(extraInput()).toHaveAttribute('readonly');
        });
    });

    describe('Staging extra income changes', () => {
        it('Adds a pending entry without sending anything, updating the total and clearing the fields', async () => {
            await openDialog();

            addEntry('49.50', 'Side gig', '01-25-2025');

            const rows = within(entryList()).getAllByRole('listitem');
            expect(rows).toHaveLength(3);
            expect(rows[0]).toHaveTextContent('Side gig');
            expect(rows[0]).toHaveTextContent('New');
            expect(rows[0]).toHaveTextContent('Jan 25, 2025 · $49.50');
            expect(extraInput()).toHaveValue('350.00');
            expect(amountInput()).toHaveValue('');
            expect(descriptionInput()).toHaveValue('');
            expect(mockMutateAsync).not.toHaveBeenCalled();
        });

        it('Defaults the entry date to the start of the month when it is not the current month', async () => {
            await openDialog();

            expect(await screen.findByLabelText('Date Received')).toHaveValue('01-01-2025');
        });

        it.each([
            ['an empty amount', '', 'Side gig', 'Field is required'],
            ['a zero amount', '0', 'Side gig', 'Enter a positive amount greater than zero'],
            ['an empty description', '10', '   ', 'Description is required'],
        ])('Does not add an entry with %s', async (_label, amount, description, message) => {
            await openDialog();

            addEntry(amount, description);

            expect(await screen.findByText(message)).toBeInTheDocument();
            expect(within(entryList()).getAllByRole('listitem')).toHaveLength(2);
        });

        it('Removes a saved entry from the list and the total', async () => {
            await openDialog();

            fireEvent.click(screen.getByLabelText('delete Bonus'));

            expect(screen.queryByText('Bonus')).not.toBeInTheDocument();
            expect(extraInput()).toHaveValue('100.50');
            expect(updateButton()).toBeEnabled();
        });

        it('Removes a pending entry, leaving nothing to save', async () => {
            await openDialog();

            addEntry('10', 'Oops');
            expect(updateButton()).toBeEnabled();

            fireEvent.click(screen.getByLabelText('delete Oops'));

            expect(screen.queryByText('Oops')).not.toBeInTheDocument();
            expect(updateButton()).toBeDisabled();
        });
    });

    describe('Update button', () => {
        it('Is disabled until something changes', async () => {
            await openDialog();

            expect(updateButton()).toBeDisabled();

            fireEvent.change(payInput(), { target: { value: '1200' } });
            expect(updateButton()).toBeEnabled();

            fireEvent.change(payInput(), { target: { value: '1100' } });
            expect(updateButton()).toBeDisabled();
        });

        it('Is disabled while either query is loading', async () => {
            mockUseFetchExtraIncome.mockReturnValue({ data: undefined, isLoading: true, isError: false });
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1200' } });

            expect(updateButton()).toBeDisabled();
            expect(extraInput()).toBeDisabled();
        });

        it('Disables pay and shows loading spinners while fetching income', async () => {
            mockUseFetchIncome.mockReturnValue({ data: undefined, isLoading: true, isError: false });
            mockUseFetchExtraIncome.mockReturnValue({ data: undefined, isLoading: true, isError: false });
            await openDialog();

            expect(payInput()).toBeDisabled();
            expect(screen.getAllByTestId('loading-spinner')).toHaveLength(2);
        });
    });

    describe('Saving', () => {
        it('Sends only the pay update when only pay changed, then closes', async () => {
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1250.75' } });
            fireEvent.click(updateButton());

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalledWith({
                    pay: { date: '01-01-2025', pay: '1250.75' },
                    added: [],
                    removed: [],
                });
            });
            await waitFor(() => {
                expect(screen.queryByText('Edit Income')).not.toBeInTheDocument();
            });
        });

        it('Sends only extra changes when pay is untouched, without validating pay', async () => {
            // Months without a pay record pre-fill 0, which the money validator rejects
            mockUseFetchIncome.mockReturnValue({ data: { pay: 0, extra: 300.5 }, isLoading: false, isError: false });
            await openDialog();

            addEntry('25', '  Refund  ', '01-10-2025');
            fireEvent.click(screen.getByLabelText('delete Gift'));
            fireEvent.click(updateButton());

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalledWith({
                    pay: undefined,
                    added: [{ date: '01-10-2025', amount: '25', description: 'Refund' }],
                    removed: [2],
                });
            });
        });

        it('Uses the selected month, not the parent date', async () => {
            await openDialog();

            fireEvent.change(await screen.findByLabelText('Month'), { target: { value: '02-01-2025' } });
            fireEvent.change(payInput(), { target: { value: '999' } });
            fireEvent.click(updateButton());

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalledWith(
                    expect.objectContaining({ pay: { date: '02-01-2025', pay: '999' } })
                );
            });
        });

        it('Does not submit an invalid pay', async () => {
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '12.345' } });
            fireEvent.click(updateButton());

            expect(await screen.findByText('Enter a valid amount with up to 2 decimal places')).toBeInTheDocument();
            expect(mockMutateAsync).not.toHaveBeenCalled();
        });

        it('Does not submit with an invalid month', async () => {
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1200' } });
            fireEvent.change(await screen.findByLabelText('Month'), { target: { value: 'not-a-date' } });
            fireEvent.click(updateButton());

            // The mocked picker doesn't render helper text, so assert the submit was blocked
            await waitFor(() => {
                expect(updateButton()).toBeEnabled();
            });
            expect(mockMutateAsync).not.toHaveBeenCalled();
        });

        it('Prevents double submission', async () => {
            mockMutateAsync.mockReturnValue(
                new Promise(() => {
                    /* never resolves */
                })
            );
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1200' } });
            fireEvent.click(updateButton());
            fireEvent.click(updateButton());

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalledTimes(1);
            });
            expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
            expect(screen.getByLabelText('delete Bonus')).toBeDisabled();
        });

        it('Keeps only the failed changes staged and stays open when some requests fail', async () => {
            mockMutateAsync.mockImplementation(() => {
                // Simulate the refresh: Bonus was deleted and Side gig was saved, Gift's delete and Refund failed
                mockUseFetchExtraIncome.mockReturnValue({
                    data: [{ id: 3, date: '2025-01-25', amount: 49.5, description: 'Side gig' }, savedExtras[1]],
                    isLoading: false,
                    isError: false,
                });
                return Promise.resolve({ payFailed: false, failedAdds: [1], failedRemovals: [2] });
            });
            await openDialog();

            addEntry('49.50', 'Side gig', '01-25-2025');
            addEntry('25', 'Refund', '01-10-2025');
            fireEvent.click(screen.getByLabelText('delete Bonus'));
            fireEvent.click(screen.getByLabelText('delete Gift'));
            fireEvent.click(updateButton());

            expect(await screen.findByText('Some changes could not be saved. Please try again.')).toBeInTheDocument();
            expect(screen.getByText('Edit Income')).toBeInTheDocument();

            const rows = within(entryList()).getAllByRole('listitem');
            expect(rows).toHaveLength(2);
            expect(rows[0]).toHaveTextContent('Side gig');
            expect(rows[0]).not.toHaveTextContent('New');
            expect(rows[1]).toHaveTextContent('Refund');
            expect(rows[1]).toHaveTextContent('New');

            // Retrying only resends what failed
            fireEvent.click(updateButton());
            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenLastCalledWith({
                    pay: undefined,
                    added: [{ date: '01-10-2025', amount: '25', description: 'Refund' }],
                    removed: [2],
                });
            });
        });

        it('Keeps an edited pay staged when only the pay update fails', async () => {
            mockMutateAsync.mockResolvedValue({ ...noFailures, payFailed: true });
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1200' } });
            fireEvent.click(updateButton());

            expect(await screen.findByText('Some changes could not be saved. Please try again.')).toBeInTheDocument();
            expect(payInput()).toHaveValue('1200');
            expect(updateButton()).toBeEnabled();
        });

        it.each([
            ['the error message', new Error('Server exploded'), 'Server exploded'],
            ['a generic message when the error has none', {}, 'Error. Please try again.'],
        ])('Shows %s when saving throws', async (_label, error, message) => {
            mockMutateAsync.mockRejectedValue(error);
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1200' } });
            fireEvent.click(updateButton());

            expect(await screen.findByText(message)).toBeInTheDocument();
        });

        it('Can dismiss the save error', async () => {
            mockMutateAsync.mockRejectedValue(new Error('Server exploded'));
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1200' } });
            fireEvent.click(updateButton());
            await screen.findByText('Server exploded');

            fireEvent.click(within(screen.getByRole('alert')).getByRole('button'));

            await waitFor(() => {
                expect(screen.queryByText('Server exploded')).not.toBeInTheDocument();
            });
        });
    });

    describe('Changing the month', () => {
        it('Refetches for the new month, re-fills pay and drops staged extra changes', async () => {
            await openDialog();

            addEntry('10', 'Pending');
            fireEvent.click(screen.getByLabelText('delete Bonus'));

            mockUseFetchIncome.mockReturnValue({ data: { pay: 2000, extra: 0 }, isLoading: false, isError: false });
            mockUseFetchExtraIncome.mockReturnValue({ data: [], isLoading: false, isError: false });
            fireEvent.change(await screen.findByLabelText('Month'), { target: { value: '03-01-2025' } });

            const params = { startDate: '03-01-2025', endDate: '03-01-2025', enabled: true };
            await waitFor(() => {
                expect(mockUseFetchIncome).toHaveBeenLastCalledWith(params);
            });
            expect(mockUseFetchExtraIncome).toHaveBeenLastCalledWith(params);
            await waitFor(() => {
                expect(payInput()).toHaveValue('2000');
            });
            expect(screen.queryByText('Pending')).not.toBeInTheDocument();
            expect(screen.getByLabelText('Date Received')).toHaveValue('03-01-2025');
            expect(updateButton()).toBeDisabled();
        });

        it.each([
            ['a partially typed year', '01-01-0002'],
            ['a month past the selectable range', dayjs().add(2, 'year').format(BASE_FORMAT)],
        ])('Ignores %s and keeps the staged changes', async (_label, value) => {
            await openDialog();

            addEntry('10', 'Pending');
            fireEvent.change(await screen.findByLabelText('Month'), { target: { value } });

            expect(mockUseFetchIncome).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: '01-01-2025' }));
            expect(screen.getByText('Pending')).toBeInTheDocument();
        });

        it('Ignores a cleared month', async () => {
            await openDialog();

            fireEvent.change(await screen.findByLabelText('Month'), { target: { value: '' } });

            expect(screen.getByLabelText('Month')).toHaveValue('01-01-2025');
        });
    });

    describe('Error handling', () => {
        it.each([
            ['income', mockUseFetchIncome],
            ['extra income', mockUseFetchExtraIncome],
        ])('Shows a load error when the %s fetch fails', async (_label, hook) => {
            hook.mockReturnValue({ data: undefined, isLoading: false, isError: true });
            await openDialog();

            expect(screen.getByText('Failed to load income data')).toBeInTheDocument();
        });

        it('Shows the save error over the load error', async () => {
            mockUseFetchExtraIncome.mockReturnValue({ data: undefined, isLoading: false, isError: true });
            mockMutateAsync.mockRejectedValue(new Error('Save failed'));
            await openDialog();

            fireEvent.change(payInput(), { target: { value: '1200' } });
            fireEvent.click(updateButton());

            expect(await screen.findByText('Save failed')).toBeInTheDocument();
            expect(screen.queryByText('Failed to load income data')).not.toBeInTheDocument();
        });
    });
});
