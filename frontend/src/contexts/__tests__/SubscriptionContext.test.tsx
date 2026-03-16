import type { SelectChangeEvent } from '@mui/material/Select';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SubscriptionContextProvider } from 'contexts/SubscriptionContext';
import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import useDateRangeContext from 'hooks/useDateRangeContext';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import useSubscriptionContext from 'hooks/useSubscriptionContext';
import useToastContext from 'hooks/useToastContext';
import { subscriptionService } from 'schema/subscription';
import type { Subscription } from 'types/Subscription.type';

// Mocks

jest.mock('hooks/useAuthContext');
jest.mock('hooks/useAuthFetch');
jest.mock('hooks/useDateRangeContext');
jest.mock('hooks/usePaginatedFetch');
jest.mock('hooks/useToastContext');
jest.mock('schema/subscription');

const mockUseAuthContext = useAuthContext as jest.Mock;
const mockUseAuthFetch = useAuthFetch as jest.Mock;
const mockUseDateRangeContext = useDateRangeContext as jest.Mock;
const mockUsePaginatedFetch = usePaginatedFetch as jest.Mock;
const mockUseToastContext = useToastContext as jest.Mock;
const mockSubscriptionService = subscriptionService as jest.Mock;

// Fixtures

const mockSubscription: Subscription = {
    id: 1,
    description: 'Netflix',
    amount: 15.99,
    category: 'Entertainment',
    interval: 'M',
    active: 1,
    nextChargeDate: '2026-04-01',
};

const makeSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
    ...mockSubscription,
    ...overrides,
});

function makePaginatedFetchReturn(overrides: Record<string, unknown> = {}) {
    return {
        data: {
            subscriptions: [mockSubscription],
            totalSum: 15.99,
            filteredSum: 15.99,
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

/**
 * Renders the real SubscriptionContextProvider and returns the live context
 * value via useSubscriptionContext. Uses the project's customRenderHook so
 * all peer providers (Toast, Auth, etc.) are already in place - no need to
 * build a manual wrapper.
 */
function renderContext() {
    return renderHook(() => useSubscriptionContext(), {
        wrapper: SubscriptionContextProvider,
    });
}

describe('SubscriptionContextProvider', () => {
    let mockToggleSubscription: jest.Mock;
    let mockDeleteSubscription: jest.Mock;
    let mockRefetch: jest.Mock;
    let mockSetPaginationModel: jest.Mock;
    let mockResetState: jest.Mock;
    let mockShowToast: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockToggleSubscription = jest.fn().mockResolvedValue(undefined);
        mockDeleteSubscription = jest.fn().mockResolvedValue(undefined);
        mockRefetch = jest.fn().mockResolvedValue(undefined);
        mockSetPaginationModel = jest.fn();
        mockResetState = jest.fn();
        mockShowToast = jest.fn();

        mockUseAuthContext.mockReturnValue({ authToken: 'token-abc' });
        mockUseAuthFetch.mockReturnValue(jest.fn());
        mockUseDateRangeContext.mockReturnValue({
            formattedStartDate: '2026-01-01',
            formattedEndDate: '2026-03-31',
        });
        mockUseToastContext.mockReturnValue({ showToast: mockShowToast });
        mockSubscriptionService.mockReturnValue({
            toggleSubscription: mockToggleSubscription,
            deleteSubscription: mockDeleteSubscription,
        });

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
        it('Exposes subscriptions from paginated fetch data', () => {
            const { result } = renderContext();
            expect(result.current.subscriptions).toEqual([mockSubscription]);
        });

        it('Exposes totalSum and filteredSum', () => {
            const { result } = renderContext();
            expect(result.current.totalSum).toBe(15.99);
            expect(result.current.filteredSum).toBe(15.99);
        });

        it('returns empty subscriptions array when data is null', () => {
            mockUsePaginatedFetch.mockReturnValue(makePaginatedFetchReturn({ data: null }));
            const { result } = renderContext();
            expect(result.current.subscriptions).toEqual([]);
        });

        it('returns null totalSum and filteredSum when data is null', () => {
            mockUsePaginatedFetch.mockReturnValue(makePaginatedFetchReturn({ data: null }));
            const { result } = renderContext();
            expect(result.current.totalSum).toBeNull();
            expect(result.current.filteredSum).toBeNull();
        });

        it('Exposes selectedInterval as empty string by default', () => {
            const { result } = renderContext();
            expect(result.current.selectedInterval).toBe('');
        });

        it('Passes additionalParams with date range and interval to usePaginatedFetch', () => {
            renderContext();
            expect(mockUsePaginatedFetch).toHaveBeenCalledWith(
                expect.objectContaining({
                    additionalParams: {
                        startDate: '2026-01-01',
                        endDate: '2026-03-31',
                        interval: '',
                    },
                })
            );
        });
    });

    describe('handleIntervalChange', () => {
        it('Updates selectedInterval when interval changes', () => {
            const { result } = renderContext();

            act(() => {
                result.current.handleIntervalChange({ target: { value: 'M' } } as SelectChangeEvent);
            });

            expect(result.current.selectedInterval).toBe('M');
        });

        it('Passes updated interval to usePaginatedFetch additionalParams', async () => {
            const { result } = renderContext();

            act(() => {
                result.current.handleIntervalChange({ target: { value: 'Y' } } as SelectChangeEvent);
            });

            await waitFor(() => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const expected = expect.objectContaining({
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    additionalParams: expect.objectContaining({ interval: 'Y' }),
                });
                expect(mockUsePaginatedFetch).toHaveBeenLastCalledWith(expected);
            });
        });

        it('Blurs the active element after change', () => {
            const mockBlur = jest.fn();
            const mockButton = document.createElement('button');
            mockButton.blur = mockBlur;
            document.body.appendChild(mockButton);
            mockButton.focus();

            const { result } = renderContext();
            act(() => {
                result.current.handleIntervalChange({ target: { value: 'M' } } as SelectChangeEvent);
            });

            expect(mockBlur).toHaveBeenCalled();
            document.body.removeChild(mockButton);
        });

        it('Does not throw when no HTMLElement is focused', () => {
            (document.activeElement as HTMLElement)?.blur?.();
            const { result } = renderContext();

            expect(() => {
                act(() => {
                    result.current.handleIntervalChange({ target: { value: 'M' } } as SelectChangeEvent);
                });
            }).not.toThrow();
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

    describe('toggleSubscription', () => {
        it('Calls subscriptionAPI.toggleSubscription with the row and an AbortSignal', async () => {
            const { result } = renderContext();

            await act(async () => {
                await result.current.toggleSubscription(mockSubscription);
            });

            expect(mockToggleSubscription).toHaveBeenCalledWith(mockSubscription, expect.any(AbortSignal));
        });

        it('Calls refetch after a successful toggle', async () => {
            const { result } = renderContext();

            await act(async () => {
                await result.current.toggleSubscription(mockSubscription);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
        });

        it('Passes the same AbortSignal to both the API call and refetch', async () => {
            let capturedSignal: AbortSignal | undefined;
            mockToggleSubscription.mockImplementation((_row: Subscription, signal: AbortSignal) => {
                capturedSignal = signal;
            });

            const { result } = renderContext();

            await act(async () => {
                await result.current.toggleSubscription(mockSubscription);
            });

            expect(capturedSignal).toBeInstanceOf(AbortSignal);
            expect(mockRefetch).toHaveBeenCalledWith(capturedSignal);
        });

        it('Shows error toast and does not call refetch when API throws', async () => {
            mockToggleSubscription.mockRejectedValue(new Error('Network error'));
            const { result } = renderContext();

            await act(async () => {
                await result.current.toggleSubscription(mockSubscription);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
            expect(mockRefetch).not.toHaveBeenCalled();
        });

        it('Shows error toast when refetch throws after a successful toggle', async () => {
            mockRefetch.mockRejectedValue(new Error('Refetch failed'));
            const { result } = renderContext();

            await act(async () => {
                await result.current.toggleSubscription(mockSubscription);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
        });
    });

    describe('deleteSubscription', () => {
        it('Calls subscriptionAPI.deleteSubscription with the correct id and an AbortSignal', async () => {
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
            });

            expect(mockDeleteSubscription).toHaveBeenCalledWith(1, expect.any(AbortSignal));
        });

        it('Calls refetch when there are multiple items on the current page', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: {
                        subscriptions: [mockSubscription, makeSubscription({ id: 2 })],
                        totalSum: 31.98,
                        filteredSum: 31.98,
                    },
                    paginationModel: { page: 1, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });

        it('Goes back one page when deleting the last item on a non-first page', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { subscriptions: [mockSubscription], totalSum: 15.99, filteredSum: 15.99 },
                    paginationModel: { page: 2, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
            });

            expect(mockSetPaginationModel).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
            expect(mockRefetch).not.toHaveBeenCalled();
        });

        it('Decrements to the correct page number regardless of which page we are on', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { subscriptions: [mockSubscription], totalSum: 15.99, filteredSum: 15.99 },
                    paginationModel: { page: 5, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
            });

            expect(mockSetPaginationModel).toHaveBeenCalledWith({ page: 4, pageSize: 10 });
        });

        it('Calls refetch (not setPaginationModel) when deleting the last item on page 0', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { subscriptions: [mockSubscription], totalSum: 15.99, filteredSum: 15.99 },
                    paginationModel: { page: 0, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });

        it('Calls refetch when the current page is already empty', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch,
                    setPaginationModel: mockSetPaginationModel,
                    data: { subscriptions: [], totalSum: 0, filteredSum: 0 },
                    paginationModel: { page: 1, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
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
                await result.current.deleteSubscription(1);
            });

            expect(mockRefetch).toHaveBeenCalledTimes(1);
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });

        it('Shows error toast and stops early when API throws', async () => {
            mockDeleteSubscription.mockRejectedValue(new Error('Server error'));
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
            expect(mockRefetch).not.toHaveBeenCalled();
            expect(mockSetPaginationModel).not.toHaveBeenCalled();
        });

        it('Shows error toast when refetch throws after a successful delete', async () => {
            mockUsePaginatedFetch.mockReturnValue(
                makePaginatedFetchReturn({
                    refetch: mockRefetch.mockRejectedValue(new Error('Refetch failed')),
                    setPaginationModel: mockSetPaginationModel,
                    data: {
                        subscriptions: [mockSubscription, makeSubscription({ id: 2 })],
                        totalSum: 31.98,
                        filteredSum: 31.98,
                    },
                    paginationModel: { page: 0, pageSize: 10 },
                })
            );
            const { result } = renderContext();

            await act(async () => {
                await result.current.deleteSubscription(1);
            });

            expect(mockShowToast).toHaveBeenCalledWith('Server Error. Please try again.', 'error');
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
