import { at, createExpenseContext, defined, render } from '@test-utils';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dayjs } from 'dayjs';
import BulkImport from 'expense/BulkImport';
import useAuthFetch from 'hooks/useAuthFetch';
import { useInvalidateWidgets } from 'hooks/useInvalidateWidgets';
import type { SyntheticEvent } from 'react';
import type { SelectOptionType } from 'types/SelectOption.type';
import { clearCategoryCache } from 'utils/categoryCache';
import { API_BASE_URL } from 'utils/constants';

jest.mock('hooks/useAuthFetch');
jest.mock('hooks/useInvalidateWidgets');
jest.mock('utils/categoryCache');

/**
 * Replace the async category autocomplete with a button that picks category id 3
 */
jest.mock('expense/CategorySelect', () => ({
    __esModule: true,
    default: ({
        handleCategorySelectChange,
        helperText,
    }: {
        handleCategorySelectChange: (event: SyntheticEvent, option: SelectOptionType | null) => void;
        helperText?: string | null;
    }) => (
        <div>
            <button
                type="button"
                onClick={(e) => {
                    handleCategorySelectChange(e, { value: 3, label: 'Groceries' });
                }}
            >
                Pick category
            </button>
            {helperText != null && helperText !== '' && <span>{helperText}</span>}
        </div>
    ),
}));

jest.mock('@mui/x-date-pickers/DatePicker', () => ({
    DatePicker: ({ value }: { value: Dayjs | null }) => (
        <input aria-label="Date" readOnly value={value?.format('MM/DD/YYYY') ?? ''} />
    ),
}));

const mockAuthFetch = jest.fn();
const mockInvalidateWidgets = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);
(useInvalidateWidgets as jest.Mock).mockReturnValue(mockInvalidateWidgets);

function mockResponse(ok: boolean, body?: unknown) {
    return {
        ok,
        status: ok ? 200 : 500,
        json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    };
}

const importResponse = mockResponse(true, {
    error: false,
    data: {
        imported: [
            { date: '01/10/2026', amount: 12.5, description: 'Coffee beans' },
            { date: '01/11/2026', amount: 40, description: 'Gas station' },
        ],
        errored: [{ row: 4, message: 'Invalid amount' }],
    },
});

interface SentExpense {
    id: string;
    description: string;
    amount: number;
    categoryid?: number | null;
    receipt?: unknown;
    receiptError?: unknown;
}

// Reads the FormData sent to the bulk save endpoint
function bulkRequest() {
    const call = mockAuthFetch.mock.calls.find(
        (c: [{ url: string }]) => c[0].url === `${API_BASE_URL}/expenses/bulk`
    ) as [{ url: string; body: FormData }] | undefined;
    const body = defined(call, 'bulk save call')[0].body;
    const expenses = JSON.parse(body.get('expenses') as string) as SentExpense[];
    return { body, expenses };
}

describe('<BulkImport />', () => {
    let showToast: jest.Mock;
    const expenseContextValue = createExpenseContext();

    const dataRows = () => screen.getAllByRole('row').slice(1); // skip the header row

    // Uploads a CSV and opens the dialog with the processed rows
    const setupWithRows = async () => {
        const user = userEvent.setup();
        mockAuthFetch.mockResolvedValueOnce(importResponse);
        render(<BulkImport />, { expenseContextValue, toastContextValue: { showToast } });

        const csv = new File(['date,amount,description'], 'expenses.csv', { type: 'text/csv' });
        await user.upload(screen.getByTestId('uploadCsvFile'), csv);
        await user.click(screen.getByRole('button', { name: /process: expenses\.csv/i }));
        await screen.findByRole('button', { name: /import 2 rows/i });
        // Wait for the lazy DatePicker chunk in each row
        await screen.findAllByRole('textbox', { name: 'Date' });
        return user;
    };

    const pickCategoryForAllRows = async (user: ReturnType<typeof userEvent.setup>) => {
        for (const row of dataRows()) {
            await user.click(within(row).getByRole('button', { name: 'Pick category' }));
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        showToast = jest.fn();
        jest.spyOn(console, 'error').mockImplementation(() => {
            /* Silence expected errors */
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Processing the CSV', () => {
        it('Should upload the CSV and show each imported row and the rows that failed', async () => {
            await setupWithRows();

            const { url, body } = (mockAuthFetch.mock.calls[0] as [{ url: string; body: FormData }])[0];
            expect(url).toBe(`${API_BASE_URL}/expenses/import`);
            expect((body.get('expenseFile') as File).name).toBe('expenses.csv');

            expect(dataRows()).toHaveLength(2);
            expect(screen.getByDisplayValue('Coffee beans')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Gas station')).toBeInTheDocument();
            expect(screen.getByText('1 Row failed to import')).toBeInTheDocument();
            expect(screen.getByText('Invalid amount')).toBeInTheDocument();
        });

        it.each([
            [
                'the API message',
                mockResponse(false, { error: true, messages: ['CSV header is missing'] }),
                'CSV header is missing',
            ],
            [
                'a generic message for a malformed body',
                mockResponse(true, { error: false, data: {} }),
                'Server Error. Please try again.',
            ],
            ['a generic message for a non-JSON body', mockResponse(false), 'Server Error. Please try again.'],
        ])('Should toast %s and close the dialog when processing fails', async (_label, response, message) => {
            const user = userEvent.setup();
            mockAuthFetch.mockResolvedValueOnce(response);
            render(<BulkImport />, { expenseContextValue, toastContextValue: { showToast } });

            await user.upload(screen.getByTestId('uploadCsvFile'), new File(['x'], 'bad.csv', { type: 'text/csv' }));
            await user.click(screen.getByRole('button', { name: /process: bad\.csv/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(message, 'error');
            });
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
        });

        it('Should toast the thrown error message when the request fails', async () => {
            const user = userEvent.setup();
            mockAuthFetch.mockRejectedValueOnce(new Error('Network down'));
            render(<BulkImport />, { expenseContextValue, toastContextValue: { showToast } });

            await user.upload(screen.getByTestId('uploadCsvFile'), new File(['x'], 'a.csv', { type: 'text/csv' }));
            await user.click(screen.getByRole('button', { name: /process: a\.csv/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Network down', 'error');
            });
        });
    });

    describe('Saving', () => {
        it('Should block saving and mark every invalid row', async () => {
            const user = await setupWithRows();

            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('2 invalid rows. Please correct issues.', 'error');
            });
            for (const row of dataRows()) {
                expect(within(row).getByText('Category is required')).toBeInTheDocument();
            }
            expect(mockAuthFetch).toHaveBeenCalledTimes(1); // only the import call
        });

        it('Should only mark the rows that are invalid', async () => {
            const user = await setupWithRows();

            await user.click(within(at(dataRows(), 0)).getByRole('button', { name: 'Pick category' }));
            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('1 invalid rows. Please correct issues.', 'error');
            });
            expect(within(at(dataRows(), 0)).queryByText('Category is required')).not.toBeInTheDocument();
            expect(within(at(dataRows(), 1)).getByText('Category is required')).toBeInTheDocument();
        });

        it.each([
            ['an empty amount as missing', '', 'Field is required'],
            ['a non-numeric amount as missing', 'abc', 'Field is required'],
            ['a zero amount as not positive', '0', 'Enter a positive amount greater than zero'],
        ])('Should report %s', async (_label, typed, message) => {
            const user = await setupWithRows();
            const firstRow = at(dataRows(), 0);
            const amount = within(firstRow).getByDisplayValue('12.5');

            await pickCategoryForAllRows(user);
            await user.clear(amount);
            if (typed !== '') await user.type(amount, typed);
            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('1 invalid rows. Please correct issues.', 'error');
            });
            expect(within(firstRow).getByText(message)).toBeInTheDocument();
            // Unparseable input is stored as null, which shows as an empty field
            expect(amount).toHaveValue(typed === 'abc' ? '' : typed);
        });

        it('Should send the edited rows as JSON without receipt fields', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setupWithRows();

            await pickCategoryForAllRows(user);
            const description = screen.getByDisplayValue('Coffee beans');
            await user.clear(description);
            await user.type(description, 'Espresso beans');
            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Expenses imported successfully!', 'success');
            });
            const { expenses } = bulkRequest();
            expect(expenses.map((e) => e.description)).toEqual(['Espresso beans', 'Gas station']);
            expect(expenses.every((e) => e.categoryid === 3)).toBe(true);
            expect(expenses.every((e) => !('receipt' in e) && !('receiptError' in e))).toBe(true);
            expect(new Set(expenses.map((e) => e.id)).size).toBe(2);
        });

        it('Should attach each receipt under the id of its row', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setupWithRows();
            const receipt = new File(['img'], 'receipt.png', { type: 'image/png' });

            await pickCategoryForAllRows(user);
            await user.upload(within(at(dataRows(), 1)).getByTestId('uploadReceipt'), receipt);
            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Expenses imported successfully!', 'success');
            });
            const { body, expenses } = bulkRequest();
            const gasRow = defined(
                expenses.find((e) => e.description === 'Gas station'),
                'gas row'
            );
            const coffeeRow = defined(
                expenses.find((e) => e.description === 'Coffee beans'),
                'coffee row'
            );
            expect(body.get(`receipt_${gasRow.id}`)).toBe(receipt);
            expect(body.get(`receipt_${coffeeRow.id}`)).toBeNull();
        });

        it('Should not send a receipt that failed validation', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = userEvent.setup({ applyAccept: false });
            mockAuthFetch.mockResolvedValueOnce(importResponse);
            render(<BulkImport />, { expenseContextValue, toastContextValue: { showToast } });
            await user.upload(screen.getByTestId('uploadCsvFile'), new File(['x'], 'e.csv', { type: 'text/csv' }));
            await user.click(screen.getByRole('button', { name: /process: e\.csv/i }));
            await screen.findByRole('button', { name: /import 2 rows/i });

            await pickCategoryForAllRows(user);
            await user.upload(
                within(at(dataRows(), 0)).getByTestId('uploadReceipt'),
                new File(['txt'], 'notes.txt', { type: 'text/plain' })
            );
            expect(await screen.findByText('Invalid file type.')).toBeInTheDocument();
            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Expenses imported successfully!', 'success');
            });
            const receiptKeys = [...bulkRequest().body.keys()].filter((k) => k.startsWith('receipt_'));
            expect(receiptKeys).toEqual([]);
        });

        it('Should refetch, refresh widgets, clear the category cache, and close on success', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setupWithRows();

            await pickCategoryForAllRows(user);
            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
            expect(expenseContextValue.refetch).toHaveBeenCalledTimes(1);
            expect(mockInvalidateWidgets).toHaveBeenCalledTimes(1);
            expect(clearCategoryCache).toHaveBeenCalledTimes(1);
        });

        it('Should toast an error and keep the dialog open when saving fails', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(false, { error: true, messages: ['nope'] }));
            const user = await setupWithRows();

            await pickCategoryForAllRows(user);
            await user.click(screen.getByRole('button', { name: /import 2 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith(
                    'Server Error. Some records failed to save. Please try again.',
                    'error'
                );
            });
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(expenseContextValue.refetch).not.toHaveBeenCalled();
        });
    });

    describe('Deleting rows', () => {
        it('Should remove a deleted row from the table and from the saved payload', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setupWithRows();

            await user.click(within(at(dataRows(), 0)).getByRole('button', { name: 'delete' }));

            expect(dataRows()).toHaveLength(1);
            expect(screen.queryByDisplayValue('Coffee beans')).not.toBeInTheDocument();

            await pickCategoryForAllRows(user);
            await user.click(screen.getByRole('button', { name: /import 1 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Expenses imported successfully!', 'success');
            });
            expect(bulkRequest().expenses.map((e) => e.description)).toEqual(['Gas station']);
        });

        it('Should not count a deleted invalid row as a validation error', async () => {
            const user = await setupWithRows();

            await user.click(within(at(dataRows(), 0)).getByRole('button', { name: 'Pick category' }));
            await user.click(within(at(dataRows(), 1)).getByRole('button', { name: 'delete' }));
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            await user.click(screen.getByRole('button', { name: /import 1 rows/i }));

            await waitFor(() => {
                expect(showToast).toHaveBeenCalledWith('Expenses imported successfully!', 'success');
            });
        });

        it('Should show an empty state and disable import once every row is deleted', async () => {
            const user = await setupWithRows();

            await user.click(within(at(dataRows(), 0)).getByRole('button', { name: 'delete' }));
            await user.click(within(at(dataRows(), 0)).getByRole('button', { name: 'delete' }));

            expect(screen.getByText('No rows to import.')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /import\s+rows/i })).toBeDisabled();
        });
    });

    describe('Closing', () => {
        it('Should discard the rows when cancelled', async () => {
            const user = await setupWithRows();

            await user.click(screen.getByRole('button', { name: 'Cancel' }));

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
            expect(screen.getByRole('button', { name: /select csv file/i })).toBeInTheDocument();
        });
    });
});
