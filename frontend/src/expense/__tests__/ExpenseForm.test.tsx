import { createExpenseContext, createSubscriptionContext, defined, render } from '@test-utils';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Dayjs } from 'dayjs';
import ExpenseForm from 'expense/ExpenseForm';
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
 * Replace the async category autocomplete with buttons that pick an existing or new category
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
                Pick existing category
            </button>
            <button
                type="button"
                onClick={(e) => {
                    handleCategorySelectChange(e, { value: 'Brand New', label: 'Brand New' });
                }}
            >
                Pick new category
            </button>
            {helperText != null && <span>{helperText}</span>}
        </div>
    ),
}));

/**
 * Simplified DatePicker that can raise a validation error
 */
jest.mock('@mui/x-date-pickers/DatePicker', () => ({
    DatePicker: ({
        value,
        label,
        onError,
        slotProps,
    }: {
        value: Dayjs;
        label: string;
        onError: (error: string | null) => void;
        slotProps?: { textField?: { helperText?: string } };
    }) => (
        <div>
            <input aria-label={label} readOnly value={value.format('MM-DD-YYYY')} />
            <button
                type="button"
                onClick={() => {
                    onError('maxDate');
                }}
            >
                Raise date error
            </button>
            <span>{slotProps?.textField?.helperText}</span>
        </div>
    ),
}));

const mockAuthFetch = jest.fn();
const mockInvalidateWidgets = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);
(useInvalidateWidgets as jest.Mock).mockReturnValue(mockInvalidateWidgets);

function mockResponse(ok: boolean, body?: unknown) {
    return {
        ok,
        status: ok ? 200 : 400,
        json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    };
}

// Reads the request sent by the form
function sentRequest() {
    const call = defined(mockAuthFetch.mock.calls[0] as [{ url: string; body: FormData }] | undefined, 'fetch call');
    return call[0];
}

describe('<ExpenseForm />', () => {
    const expenseContextValue = createExpenseContext();
    const subscriptionContextValue = createSubscriptionContext();

    const setup = async () => {
        const user = userEvent.setup();
        render(<ExpenseForm />, { expenseContextValue, subscriptionContextValue });

        await user.click(screen.getByRole('button', { name: /track expense/i }));
        // Wait for the lazy DatePicker chunk to load
        await screen.findByRole('textbox', { name: 'Date' });
        return user;
    };

    const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(screen.getByRole('textbox', { name: /description/i }), 'Weekly groceries');
        await user.type(screen.getByRole('textbox', { name: /amount/i }), '42.50');
        await user.click(screen.getByRole('button', { name: 'Pick existing category' }));
    };

    const submit = (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByRole('button', { name: 'Track' }));

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        jest.spyOn(console, 'error').mockImplementation(() => {
            /* Silence expected errors */
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Successful submit', () => {
        it('Should POST the expense as FormData with an existing category id', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setup();

            await fillValidForm(user);
            await submit(user);

            await waitFor(() => {
                expect(mockAuthFetch).toHaveBeenCalledTimes(1);
            });
            const { url, body } = sentRequest();
            expect(url).toBe(`${API_BASE_URL}/expenses`);
            expect(body.get('description')).toBe('Weekly groceries');
            expect(body.get('amount')).toBe('42.50');
            expect(body.get('categoryid')).toBe('3');
            expect(body.get('category')).toBeNull();
            expect(body.get('date')).toMatch(/^\d{2}-\d{2}-\d{4}$/);
            expect(body.get('interval')).toBeNull();
        });

        it('Should refetch expenses, refresh widgets, keep the category cache, and close', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setup();

            await fillValidForm(user);
            await submit(user);

            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
            });
            expect(expenseContextValue.refetch).toHaveBeenCalledTimes(1);
            expect(subscriptionContextValue.refetch).not.toHaveBeenCalled();
            expect(mockInvalidateWidgets).toHaveBeenCalledTimes(1);
            expect(clearCategoryCache).not.toHaveBeenCalled();
        });

        it('Should send a new category by name and clear the category cache', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setup();

            await user.type(screen.getByRole('textbox', { name: /description/i }), 'Something new');
            await user.type(screen.getByRole('textbox', { name: /amount/i }), '5');
            await user.click(screen.getByRole('button', { name: 'Pick new category' }));
            await submit(user);

            await waitFor(() => {
                expect(clearCategoryCache).toHaveBeenCalledTimes(1);
            });
            expect(sentRequest().body.get('category')).toBe('Brand New');
            expect(sentRequest().body.get('categoryid')).toBeNull();
        });

        it('Should POST to subscriptions with the interval and refetch both lists', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(true, { error: false }));
            const user = await setup();

            await fillValidForm(user);
            await user.click(screen.getByRole('checkbox', { name: 'Subscription' }));
            await user.click(screen.getByRole('radio', { name: 'Monthly' }));
            await submit(user);

            await waitFor(() => {
                expect(subscriptionContextValue.refetch).toHaveBeenCalledTimes(1);
            });
            expect(expenseContextValue.refetch).toHaveBeenCalledTimes(1);
            expect(sentRequest().url).toBe(`${API_BASE_URL}/subscriptions`);
            expect(sentRequest().body.get('interval')).toBe('M');
        });
    });

    describe('Validation', () => {
        it('Should not submit and show errors when required fields are empty', async () => {
            const user = await setup();

            await submit(user);

            expect(await screen.findByText('Description must be at least 3 characters')).toBeInTheDocument();
            expect(screen.getByText('Field is required')).toBeInTheDocument();
            expect(screen.getByText('Category is required')).toBeInTheDocument();
            expect(mockAuthFetch).not.toHaveBeenCalled();
        });

        it('Should require an interval when Subscription is checked', async () => {
            const user = await setup();

            await fillValidForm(user);
            await user.click(screen.getByRole('checkbox', { name: 'Subscription' }));
            await submit(user);

            expect(await screen.findByText('Please select an interval')).toBeInTheDocument();
            expect(mockAuthFetch).not.toHaveBeenCalled();
        });

        it('Should show the date error and block submit', async () => {
            const user = await setup();

            await fillValidForm(user);
            await user.click(screen.getByRole('button', { name: 'Raise date error' }));
            await submit(user);

            expect(await screen.findByText('Please select a date within a 1-year range')).toBeInTheDocument();
            expect(mockAuthFetch).not.toHaveBeenCalled();
        });
    });

    describe('Server errors', () => {
        it.each([
            [
                'the API messages',
                mockResponse(false, { error: true, messages: ['Bad amount', 'Bad date'] }),
                'Bad amount,Bad date',
            ],
            ['a generic message for a non-JSON body', mockResponse(false), 'Server Error. Please try again.'],
            [
                'a generic message for a malformed body',
                mockResponse(false, { error: 'yes' }),
                'Server Error. Please try again.',
            ],
            [
                'a generic message when there are no messages',
                mockResponse(false, { error: false }),
                'Server Error. Please try again.',
            ],
            ['a generic message when not authenticated', null, 'Server Error. Please try again.'],
        ])('Should show %s and stay open', async (_label, response, expected) => {
            mockAuthFetch.mockResolvedValue(response);
            const user = await setup();

            await fillValidForm(user);
            await submit(user);

            expect(await screen.findByRole('alert')).toHaveTextContent(expected);
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(expenseContextValue.refetch).not.toHaveBeenCalled();
            expect(mockInvalidateWidgets).not.toHaveBeenCalled();
        });

        it('Should show a connection error when the request throws', async () => {
            mockAuthFetch.mockRejectedValue(new Error('Network down'));
            const user = await setup();

            await fillValidForm(user);
            await submit(user);

            expect(await screen.findByRole('alert')).toHaveTextContent(
                'Unable to connect to the server. Please try again.'
            );
        });

        it('Should let the user dismiss the server error', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(false));
            const user = await setup();

            await fillValidForm(user);
            await submit(user);
            const alert = await screen.findByRole('alert');

            await user.click(within(alert).getByRole('button'));

            await waitFor(() => {
                expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            });
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
    });
});
