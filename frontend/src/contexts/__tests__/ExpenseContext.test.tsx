import { act, renderHook } from '@testing-library/react';
import { ExpenseContextProvider } from 'contexts/ExpenseContext';
import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import useDateRangeContext from 'hooks/useDateRangeContext';
import useExpenseContext from 'hooks/useExpenseContext';
import { useInvalidateWidgets } from 'hooks/useInvalidateWidgets';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import useToastContext from 'hooks/useToastContext';
import type { Expense } from 'types/Expense.type';
import { API_BASE_URL } from 'utils/constants';

// Mocks

jest.mock('hooks/useAuthContext');
jest.mock('hooks/useAuthFetch');
jest.mock('hooks/useDateRangeContext');
jest.mock('hooks/useInvalidateWidgets');
jest.mock('hooks/usePaginatedFetch');
jest.mock('hooks/useToastContext');

const mockUseAuthContext = useAuthContext as jest.Mock;
const mockUseAuthFetch = useAuthFetch as jest.Mock;
const mockUseDateRangeContext = useDateRangeContext as jest.Mock;
const mockUseInvalidateWidgets = useInvalidateWidgets as jest.Mock;
const mockUsePaginatedFetch = usePaginatedFetch as jest.Mock;
const mockUseToastContext = useToastContext as jest.Mock;

// Fixtures

const mockExpense: Expense = {
    id: 1,
    description: 'Groceries',
    amount: 54.32,
    category: 'Food',
    date: '2026-03-01',
    receipt: 0,
};

const makeExpense = (overrides: Partial<Expense> = {}): Expense => ({
    ...mockExpense,
    ...overrides,
});

function makeDeleteResponse(overrides: Partial<{ ok: boolean; error: string | null }> = {}): Response {
    const { ok = true, error = null } = overrides;
    return {
        ok,
        json: jest.fn().mockResolvedValue({ error }),
    } as unknown as Response;
}

function makePaginatedFetchReturn(overrides: Record<string, unknown> = {}) {
    return {
        data: {
            expenses: [mockExpense],
            totalSum: 54.32,
            filteredSum: 54.32,
        },
        loading: false,
        error: null,
        paginationModel: { page: 0, pageSize: 10 },
        setPaginationModel: jest.fn(),
        sortModel: [],
        setSortModel: jest.fn(),
        filterModel: { items: [] },
        setFilterModel: jest.fn(),
        totalRowCount: 1,
        refetch: jest.fn().mockResolvedValue(undefined),
        resetState: jest.fn(),
        handlePaginationModelChange: jest.fn(),
        handleSortModelChange: jest.fn(),
        handleFilterModelChange: jest.fn(),
        ...overrides,
    };
}

function renderContext() {
    return renderHook(() => useExpenseContext(), {
        wrapper: ExpenseContextProvider,
    });
}

describe('ExpenseContextProvider', () => {
    let mockAuthFetch: jest.Mock;
    let mockRefetch: jest.Mock;
    let mockSetPaginationModel: jest.Mock;
    let mockResetState: jest.Mock;
    let mockShowToast: jest.Mock;
    let mockInvalidateWidgets: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockAuthFetch = jest.fn().mockResolvedValue(makeDeleteResponse());
        mockRefetch = jest.fn().mockResolvedValue(undefined);
        mockSetPaginationModel = jest.fn();
        mockResetState = jest.fn();
        mockShowToast = jest.fn();
        mockInvalidateWidgets = jest.fn();

        mockUseAuthContext.mockReturnValue({ authToken: 'token-abc' });
        mockUseAuthFetch.mockReturnValue(mockAuthFetch);
        mockUseDateRangeContext.mockReturnValue({
            formattedStartDate: '2026-01-01',
            formattedEndDate: '2026-03-31',
        });
        mockUseToastContext.mockReturnValue({ showToast: mockShowToast });
        mockUseInvalidateWidgets.mockReturnValue(mockInvalidateWidgets);

        mockUsePaginatedFetch.mockReturnValue(
            makePaginatedFetchReturn({
                refetch: mockRefetch,
                setPaginationModel: mockSetPaginationModel,
                resetState: mockResetState,
            })
        );

        jest.spyOn(console, 'error').mockImplementation(() => {
            // Silence expected errors
        });
    });

    describe('Initial state', () => {
        it('Exposes expenses from paginated fetch data', () => {
            const { result } = renderContext();
            expect(result.current.expenses).toEqual([mockExpense]);
        });

        it('Exposes totalSum and filteredSum', () => {
            const { result } = renderContext();
            expect(result.current.totalSum).toBe(54.32);
            expect(result.current.filteredSum).toBe(54.32);
        });

        it('Returns empty expenses array when data is null', () => {
            mockUsePaginatedFetch.mockReturnValue(makePaginatedFetchReturn({ data: null }));
            const { result } = renderContext();
            expect(result.current.expenses).toEqual([]);
        });

        it('Returns null totalSum and filteredSum when data is null', () => {
            mockUsePaginatedFetch.mockReturnValue(makePaginatedFetchReturn({ data: null }));
            const { result } = renderContext();
            expect(result.current.totalSum).toBeNull();
            expect(result.current.filteredSum).toBeNull();
        });

        it('Passes additionalParams with date range to usePaginatedFetch', () => {
            renderContext();
            expect(mockUsePaginatedFetch).toHaveBeenCalledWith(
                expect.objectContaining({
                    additionalParams: {
                        startDate: '2026-01-01',
                        endDate: '2026-03-31',
                    },
                })
            );
        });

        it('Passes correct endpoint and default sort to usePaginatedFetch', () => {
            renderContext();
            expect(mockUsePaginatedFetch).toHaveBeenCalledWith(
                expect.objectContaining({
                    endpoint: `${API_BASE_URL}/expenses`,
                    defaultSort: [{ field: 'date', sort: 'desc' }],
                })
            );
        });
    });

    describe('Auth token changes', () => {
        it('Calls resetState when authToken becomes falsy', () => {
            mockUseAuthContext.mockReturnValue({ authToken: 'token-abc' });
            const { rerender } = renderContext();

            mockUseAuthContext.mockReturnValue({ authToken: null });
            rerender();

            expect(mockResetState).toHaveBeenCalledTimes(1);
        });

        it('Does not call resetState when authToken is present on mount', () => {
            mockUseAuthContext.mockReturnValue({ authToken: 'token-abc' });
            renderContext();
            expect(mockResetState).not.toHaveBeenCalled();
        });

        it('Does not call resetState when authToken changes between two truthy values', () => {
            mockUseAuthContext.mockReturnValue({ authToken: 'token-abc' });
            const { rerender } = renderContext();

            mockUseAuthContext.mockReturnValue({ authToken: 'token-xyz' });
            rerender();

            expect(mockResetState).not.toHaveBeenCalled();
        });
    });

    describe('deleteExpense', () => {
        it('Calls authFetch with the correct url and DELETE method', async () => {
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockAuthFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/expenses/1`,
                method: 'DELETE',
            });
        });

        it('Calls authFetch with the correct expense id in the url', async () => {
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(42);
            });

            expect(mockAuthFetch).toHaveBeenCalledWith(expect.objectContaining({ url: `${API_BASE_URL}/expenses/42` }));
        });

        it('Returns early without refetch or toast when authFetch returns null', async () => {
            mockAuthFetch.mockResolvedValue(null);
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).not.toHaveBeenCalled();
            expect(mockShowToast).not.toHaveBeenCalled();
            expect(mockInvalidateWidgets).not.toHaveBeenCalled();
        });

        it('Returns early without refetch or toast when authFetch returns undefined', async () => {
            mockAuthFetch.mockResolvedValue(undefined);
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).not.toHaveBeenCalled();
            expect(mockShowToast).not.toHaveBeenCalled();
            expect(mockInvalidateWidgets).not.toHaveBeenCalled();
        });

        it('Shows error toast when response.ok is false', async () => {
            mockAuthFetch.mockResolvedValue(makeDeleteResponse({ ok: false }));
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
        });

        it('Does not call refetch or invalidateWidgets when response.ok is false', async () => {
            mockAuthFetch.mockResolvedValue(makeDeleteResponse({ ok: false }));
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).not.toHaveBeenCalled();
            expect(mockInvalidateWidgets).not.toHaveBeenCalled();
        });

        it('Shows error toast when response JSON contains an error', async () => {
            mockAuthFetch.mockResolvedValue(makeDeleteResponse({ error: 'Bad Request' }));
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
        });

        it('Does not call refetch or invalidateWidgets when response JSON contains an error', async () => {
            mockAuthFetch.mockResolvedValue(makeDeleteResponse({ error: 'Bad Request' }));
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).not.toHaveBeenCalled();
            expect(mockInvalidateWidgets).not.toHaveBeenCalled();
        });

        it('Shows error toast when authFetch throws', async () => {
            mockAuthFetch.mockRejectedValue(new Error('Network failure'));
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
            expect(mockRefetch).not.toHaveBeenCalled();
            expect(mockInvalidateWidgets).not.toHaveBeenCalled();
        });

        it('Shows error toast when refetch throws after a successful delete', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch.mockRejectedValue(new Error('Refetch failed')),
                    data: {
                        expenses: [mockExpense, makeExpense({ id: 2 })],
                        totalSum: 108.64,
                        filteredSum: 108.64,
                    },
                    paginationModel: { page: 0, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
        });

        it('Calls refetch when there are multiple items on the current page', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: {
                        expenses: [mockExpense, makeExpense({ id: 2 })],
                        totalSum: 108.64,
                        filteredSum: 108.64,
                    },
                    paginationModel: { page: 1, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });

        it('Calls invalidateWidgets after a successful delete with multiple items', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    data: {
                        expenses: [mockExpense, makeExpense({ id: 2 })],
                        totalSum: 108.64,
                        filteredSum: 108.64,
                    },
                    paginationModel: { page: 0, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockInvalidateWidgets).toHaveBeenCalledTimes(1);
        });

        it('Goes back one page when deleting the last item on a non-first page', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { expenses: [mockExpense], totalSum: 54.32, filteredSum: 54.32 },
                    paginationModel: { page: 2, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockSetPaginationModel).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
            expect(mockRefetch).not.toHaveBeenCalled();
        });

        it('Decrements to the correct page number regardless of which page we are on', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { expenses: [mockExpense], totalSum: 54.32, filteredSum: 54.32 },
                    paginationModel: { page: 5, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockSetPaginationModel).toHaveBeenCalledWith({ page: 4, pageSize: 10 });
        });

        it('Calls invalidateWidgets when going back a page', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    setPaginationModel: mockSetPaginationModel,
                    data: { expenses: [mockExpense], totalSum: 54.32, filteredSum: 54.32 },
                    paginationModel: { page: 2, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockInvalidateWidgets).toHaveBeenCalledTimes(1);
        });

        it('Calls refetch (not setPaginationModel) when deleting the last item on page 0', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { expenses: [mockExpense], totalSum: 54.32, filteredSum: 54.32 },
                    paginationModel: { page: 0, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });

        it('Calls refetch when the current page is already empty', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { expenses: [], totalSum: 0, filteredSum: 0 },
                    paginationModel: { page: 1, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });

        it('Calls refetch when data is null', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: null,
                    paginationModel: { page: 1, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteExpense(1);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });
    });

    describe('Context value passthrough', () => {
        it('Exposes loading and error state from usePaginatedFetch', () => {
            const mockError = new Error('Fetch failed');
            mockUsePaginatedFetch.mockReturnValue(makePaginatedFetchReturn({ loading: true, error: mockError }));
            const { result } = renderContext();
            expect(result.current.loading).toBe(true);
            expect(result.current.error).toBe(mockError);
        });

        it('Exposes pagination, sort, and filter models', () => {
            const { result } = renderContext();
            expect(result.current.paginationModel).toEqual({ page: 0, pageSize: 10 });
            expect(result.current.sortModel).toEqual([]);
            expect(result.current.filterModel).toEqual({ items: [] });
            expect(result.current.totalRowCount).toBe(1);
        });

        it('Exposes all handler functions', () => {
            const { result } = renderContext();
            const handlers = [
                'handlePaginationModelChange',
                'handleSortModelChange',
                'handleFilterModelChange',
                'setPaginationModel',
                'setSortModel',
                'setFilterModel',
                'refetch',
                'resetState',
            ] as const;

            handlers.forEach((handler) => {
                expect(typeof result.current[handler]).toBe('function');
            });
        });
    });
});
