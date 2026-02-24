import type { MockAbortController } from '@test-utils';
import { renderHook } from '@test-utils';
import { act, waitFor } from '@testing-library/react';
import useFetchIncome from 'hooks/useFetchIncome';

/**
 * Mock fetch
 */
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

/**
 * Mock the API response
 */
const mockIncomeResponse = {
    data: { pay: 1000, extra: 200 },
    error: false,
    pagination: {
        page: 1,
        offset: 0,
        totalRecords: 0,
        filteredRecords: 0,
        totalPages: 0,
    },
};

describe('useFetchIncome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {
            /* empty */
        }); // Silence expected errors
    });

    it('Should fetch data successfully on mount', async () => {
        // Mock a successful fetch
        mockFetch.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => mockIncomeResponse }), 10))
        );

        const { result } = renderHook(() =>
            useFetchIncome({
                additionalParams: { startDate: '2025-01', endDate: '2025-02' },
            })
        );

        // Should start loading
        expect(result.current.loading).toBe(true);

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result.current.data).toEqual(mockIncomeResponse.data);
        expect(result.current.error).toBeNull();
    });

    it('Should handle fetch errors', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
        });

        const { result } = renderHook(() =>
            useFetchIncome({
                additionalParams: { startDate: '2025-01', endDate: '2025-02' },
            })
        );

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBe('Error Retrieving Income. Please try again.');
    });

    it('Should handle validation failure', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({ pay: -100, extra: 200 }), // Invalid negative pay
        });

        const { result } = renderHook(() =>
            useFetchIncome({
                additionalParams: { startDate: '2025-01', endDate: '2025-02' },
            })
        );

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.data).toBeNull();
        expect(result.current.error).toContain('Validation failed');
    });

    it('Should skip fetching when skip is true', () => {
        const { result } = renderHook(() => useFetchIncome({ skip: true }));

        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBeNull();
        expect(result.current.error).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Should refetch data when refetch is called', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => mockIncomeResponse,
        });

        const { result } = renderHook(() =>
            useFetchIncome({
                additionalParams: { startDate: '2025-01', endDate: '2025-02' },
            })
        );

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result.current.data).toEqual(mockIncomeResponse.data);
        expect(result.current.error).toBeNull();

        // Mock a new fetch response
        const newResponse = { pay: 2000, extra: 400 };
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => {
                return { ...mockIncomeResponse, data: newResponse };
            },
        });

        await act(async () => {
            await result.current.refetch();
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(result.current.data).toEqual(newResponse);
    });

    it('Should abort previous requests when a new fetch is triggered', async () => {
        // Mock a successful fetch
        mockFetch.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => mockIncomeResponse }), 10))
        );

        // Mock abort controller
        const abortControllerMock = jest.fn().mockImplementation(() => ({
            signal: new EventTarget(),
            abort: jest.fn(),
        }));
        (global as unknown as { AbortController: typeof AbortController }).AbortController = abortControllerMock;

        const { result } = renderHook(() =>
            useFetchIncome({
                additionalParams: { startDate: '2025-01', endDate: '2025-02' },
            })
        );

        // Trigger multiple refetches
        act(() => {
            void result.current.refetch();
        });

        act(() => {
            void result.current.refetch();
        });

        act(() => {
            void result.current.refetch();
        });

        act(() => {
            void result.current.refetch();
        });

        // Expect all calls to instantiate their own AbortController
        // 5 fetches (1 on mount, 4 refetches above)
        expect(abortControllerMock).toHaveBeenCalledTimes(5);

        // Type-safe way to access mock results
        const controllers = abortControllerMock.mock.results.map((result) => result.value as MockAbortController);

        // Expect the first 3 refetches to be aborted
        // Index 0: initial mount (not aborted by subsequent calls)
        // Index 1-3: first three refetches (aborted by subsequent ones)
        // Index 4: last refetch (not aborted)
        expect(controllers[1].abort).toHaveBeenCalledTimes(1);
        expect(controllers[2].abort).toHaveBeenCalledTimes(1);
        expect(controllers[3].abort).toHaveBeenCalledTimes(1);
        expect(controllers[4].abort).not.toHaveBeenCalled();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Should have only called fetch 5 times total (once on mount + 4 refetches)
        expect(global.fetch).toHaveBeenCalledTimes(5);
    });
});
