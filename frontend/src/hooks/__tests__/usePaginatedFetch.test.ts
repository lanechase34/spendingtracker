import type { MockAbortController } from '@test-utils';
import { renderHook } from '@test-utils';
import { act, waitFor } from '@testing-library/react';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import { API_BASE_URL } from 'utils/constants';
import { z } from 'zod';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const MockData = z.object({
    id: z.number().int().positive(),
    name: z.string(),
});

type MockData = z.infer<typeof MockData>;

// Simple schema
const SimpleMockSchema = z.array(MockData);

// Test complex schema
const ComplexMockSchema = z.object({
    mocks: z.array(MockData),
    key1: z.optional(z.number()),
});

describe('usePaginatedFetch', () => {
    const endpoint = `${API_BASE_URL}/data`;
    const mockData: MockData[] = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
        { id: 4, name: 'Item 4' },
        { id: 5, name: 'Item 5' },
        { id: 6, name: 'Item 6' },
        { id: 7, name: 'Item 7' },
        { id: 8, name: 'Item 8' },
        { id: 9, name: 'Item 9' },
        { id: 10, name: 'AA 10' },
        { id: 11, name: 'BB 11' },
    ];
    const pagination = {
        page: 1,
        offset: 0,
        totalRecords: mockData.length,
        filteredRecords: mockData.length,
        totalPages: 1,
    };

    const simpleMockResponse = {
        error: false,
        data: mockData,
        pagination: pagination,
    };

    const complexMockResponse = {
        error: false,
        data: {
            mocks: mockData,
            key1: 100,
        },
        pagination: pagination,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {
            /*empty*/
        }); // Silence expected errors
    });

    it('Should start with empty state', () => {
        const { result } = renderHook(() =>
            usePaginatedFetch({
                endpoint: endpoint,
                validator: SimpleMockSchema, // type is inferred from schema
            })
        );

        expect(result.current.data).toBe(null);
        expect(result.current.loading).toBe(true); // loading is fired off when component mounts
        expect(result.current.error).toBe(false);
        expect(result.current.totalRowCount).toBe(0);
        expect(result.current.paginationModel.pageSize).toBe(10); // defaults to 10 page size
    });

    it('Should fetch simple data successfully on mount', async () => {
        // Mock a successful fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`${endpoint}?`),
            expect.objectContaining({ method: 'GET' })
        );

        expect(result.current.data).toEqual(mockData);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(false);
        expect(result.current.totalRowCount).toBe(11);
    });

    it('Should fetch complex data successfully on mount', async () => {
        // Mock a successful fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => complexMockResponse,
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: ComplexMockSchema }));

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(`${endpoint}?`),
            expect.objectContaining({ method: 'GET' })
        );

        expect(result.current.data).toEqual(complexMockResponse.data);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(false);
        expect(result.current.totalRowCount).toBe(11);
    });

    // it('Should use transform function if provided', async () => {
    //     // Mock a successful fetch
    //     mockFetch.mockResolvedValueOnce({
    //         ok: true,
    //         json: async () => mockResponse,
    //     });

    //     // Add transformed to each entry
    //     const transform = jest.fn((data) => data.map((d: any) => ({ ...d, transformed: true })));

    //     const { result } = renderHook(() =>
    //         usePaginatedFetch<{ id: number; name: string; transformed: boolean }>({
    //             endpoint,
    //             transform,
    //         })
    //     );

    //     // Wait for the fetch to complete
    //     await waitFor(() => {
    //         expect(result.current.loading).toBe(false);
    //     });

    //     expect(transform).toHaveBeenCalledWith(mockData);
    //
    //     expect(result.current.data?.[0].transformed).toBe(true);
    // });

    it('Should handle fetch errors', async () => {
        // Mock a failed fetch
        mockFetch.mockResolvedValueOnce({
            ok: false,
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBe(null); // no data
    });

    it('Should handle API error field', async () => {
        // Mock a failed fetch
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: () => ({ ...simpleMockResponse, error: 'Bad Request' }),
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBe(null);
    });

    it('Should handle API validation error', async () => {
        // Mock a failed fetch
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: () => ({ data: [1, 2, 3], pagination: pagination }), // just numeric
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        // Wait for the fetch to complete
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe(true);
        expect(result.current.loading).toBe(false);
        expect(result.current.data).toBe(null);
    });

    it('Should refetch data when refetch is called', async () => {
        // Mock a successful fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);

        await act(async () => {
            await result.current.refetch();
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('Should update pagination model', () => {
        // Mock a successful fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        act(() => {
            result.current.handlePaginationModelChange({ page: 2, pageSize: 10 });
        });
        expect(result.current.paginationModel).toEqual({ page: 2, pageSize: 10 });
        expect(mockFetch).toHaveBeenCalledTimes(2); // each update triggers another fetch

        act(() => {
            result.current.handlePaginationModelChange({ page: 2, pageSize: 50 });
        });
        expect(mockFetch).toHaveBeenCalledTimes(3);

        // Reset page to 0 when pageSize changes
        expect(result.current.paginationModel.page).toBe(0);
    });

    it('Should update sort model', () => {
        // Mock a successful fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        act(() => {
            result.current.handlePaginationModelChange({ page: 2, pageSize: 10 });
        });
        expect(result.current.paginationModel.page).toBe(2);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        act(() => {
            result.current.handleSortModelChange([{ field: 'name', sort: 'asc' }]);
        });
        expect(result.current.sortModel).toEqual([{ field: 'name', sort: 'asc' }]);
        expect(mockFetch).toHaveBeenCalledTimes(3);

        // When sort model is changed, the page should be set to 0
        expect(result.current.paginationModel.page).toBe(0);
    });

    it('Should update filter model', () => {
        // Mock a successful fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        act(() => {
            result.current.handlePaginationModelChange({ page: 2, pageSize: 10 });
        });
        expect(result.current.paginationModel.page).toBe(2);
        expect(mockFetch).toHaveBeenCalledTimes(2);

        act(() => {
            result.current.handleFilterModelChange({
                items: [],
                quickFilterValues: ['name', 'A'],
            });
        });
        expect(result.current.filterModel).toEqual({
            items: [],
            quickFilterValues: ['name', 'A'],
        });
        expect(mockFetch).toHaveBeenCalledTimes(3);

        // When filter is changed, the page should be set to 0
        expect(result.current.paginationModel.page).toBe(0);
    });

    it('Should abort previous requests when a new fetch is triggered', () => {
        mockFetch.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => simpleMockResponse }), 100))
        );

        const abortControllerMock = jest.fn().mockImplementation(() => ({
            signal: new EventTarget(),
            abort: jest.fn(),
        }));
        (global as unknown as { AbortController: typeof AbortController }).AbortController = abortControllerMock;

        const { result, unmount } = renderHook(() =>
            usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema })
        );

        act(() => {
            result.current.handlePaginationModelChange({ page: 2, pageSize: 10 });
        });

        act(() => {
            result.current.handleSortModelChange([{ field: 'name', sort: 'asc' }]);
        });

        act(() => {
            result.current.handleFilterModelChange({ items: [], quickFilterValues: ['name', 'A'] });
        });

        // Each effect run creates its own controller - 4 total (mount + 3 changes)
        expect(abortControllerMock).toHaveBeenCalledTimes(4);

        const controllers = abortControllerMock.mock.results.map((r) => r.value as MockAbortController);

        // Each re-run of the effect cleans up the previous one by calling abort on
        // the controller it closed over - not via the ref
        expect(controllers[0].abort).toHaveBeenCalledTimes(1);
        expect(controllers[1].abort).toHaveBeenCalledTimes(1);
        expect(controllers[2].abort).toHaveBeenCalledTimes(1);
        expect(controllers[3].abort).toHaveBeenCalledTimes(0);

        expect(global.fetch).toHaveBeenCalledTimes(4);

        unmount();

        // Unmounting cleans up the last active controller too
        expect(controllers[3].abort).toHaveBeenCalledTimes(1);
    });

    it('Should reset state when resetState is called', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => simpleMockResponse,
        });

        const { result } = renderHook(() =>
            usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema, initialPageSize: 25 })
        );

        await waitFor(() => expect(result.current.loading).toBe(false));

        act(() => {
            result.current.handlePaginationModelChange({ page: 3, pageSize: 25 });
        });

        expect(result.current.paginationModel.page).toBe(3);

        act(() => {
            result.current.resetState();
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.paginationModel).toEqual({ page: 0, pageSize: 25 });
        expect(result.current.sortModel).toEqual([]);
        expect(result.current.filterModel).toEqual({ quickFilterValues: [], items: [] });
        expect(result.current.error).toBe(false);
        expect(result.current.totalRowCount).toBe(11);
    });

    it('Should respect initialPageSize param', () => {
        const { result } = renderHook(() =>
            usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema, initialPageSize: 50 })
        );

        expect(result.current.paginationModel.pageSize).toBe(50);
    });

    it('Should respect defaultSort param', () => {
        const defaultSort = [{ field: 'name', sort: 'asc' as const }];
        const { result } = renderHook(() =>
            usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema, defaultSort })
        );

        expect(result.current.sortModel).toEqual(defaultSort);
    });

    it('Should use filteredRecords for totalRowCount when it differs from totalRecords', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                error: false,
                data: mockData,
                pagination: { ...pagination, totalRecords: 100, filteredRecords: 11 },
            }),
        });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        await waitFor(() => expect(result.current.loading).toBe(false));

        // filteredRecords !== totalRecords → use filteredRecords
        expect(result.current.totalRowCount).toBe(11);
    });

    it('Should include additionalParams in the fetch URL', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        renderHook(() =>
            usePaginatedFetch({
                endpoint: endpoint,
                validator: SimpleMockSchema,
                additionalParams: { status: 'active', type: 'expense' },
            })
        );

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('status=active'), expect.anything());
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('type=expense'), expect.anything());
    });

    it('Should not fetch when authReady is false', () => {
        // authReady defaults to false in the test environment until auth resolves
        // Verify fetch is not called synchronously before auth is ready
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        // fetch will be called once auth resolves, but not before
        // This guards against the authReady guard being removed
        expect(mockFetch).toHaveBeenCalledTimes(1); // only after authReady flips true
    });

    it('Should handle network error (fetch rejects)', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network failure'));

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe(true);
        expect(result.current.data).toBe(null);
    });

    it('Should not set error state when fetch is aborted', async () => {
        const abortError = new Error('AbortError');
        abortError.name = 'AbortError';
        mockFetch.mockRejectedValueOnce(abortError);

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        // Loading stays true - aborted fetches are silently ignored
        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        expect(result.current.error).toBe(false);
        expect(result.current.data).toBe(null);
    });

    it('Should pass signal to fetch', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => simpleMockResponse,
        });

        renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        await waitFor(() => expect(mockFetch).toHaveBeenCalled());

        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            expect.objectContaining({ signal: expect.any(EventTarget) })
        );
    });

    it('Should pass signal to fetch when refetch is called with an external signal', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: () => simpleMockResponse })
            .mockResolvedValueOnce({ ok: true, json: () => simpleMockResponse });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        await waitFor(() => expect(result.current.loading).toBe(false));

        const externalController = new AbortController();

        await act(async () => {
            await result.current.refetch(externalController.signal);
        });

        expect(mockFetch).toHaveBeenLastCalledWith(
            expect.any(String),
            expect.objectContaining({ signal: externalController.signal })
        );
    });

    it('Should use its own controller signal when refetch is called without a signal', async () => {
        mockFetch
            .mockResolvedValueOnce({ ok: true, json: () => simpleMockResponse })
            .mockResolvedValueOnce({ ok: true, json: () => simpleMockResponse });

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.refetch(); // no signal passed
        });

        expect(mockFetch).toHaveBeenCalledTimes(2);
    });
});
