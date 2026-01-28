import { waitFor, act } from '@testing-library/react';
import { renderHook } from '@test-utils';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import type { MockAbortController } from '@test-utils';
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
    const endpoint = '/spendingtracker/api/v1/data';
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
            result.current.handleFilterModelChange({ items: [], quickFilterValues: ['name', 'A'] });
        });
        expect(result.current.filterModel).toEqual({ items: [], quickFilterValues: ['name', 'A'] });
        expect(mockFetch).toHaveBeenCalledTimes(3);

        // When filter is changed, the page should be set to 0
        expect(result.current.paginationModel.page).toBe(0);
    });

    it('Should abort previous requests when a new fetch is triggered', async () => {
        // Mock a successful fetch
        mockFetch.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => simpleMockResponse }), 10))
        );

        // Mock abort controller
        const abortControllerMock = jest.fn().mockImplementation(() => ({
            signal: new EventTarget(),
            abort: jest.fn(),
        }));
        (global as unknown as { AbortController: typeof AbortController }).AbortController = abortControllerMock;

        const { result } = renderHook(() => usePaginatedFetch({ endpoint: endpoint, validator: SimpleMockSchema }));

        // Each pagination, sort, filter update triggers a re-fetch of the data
        act(() => {
            result.current.handlePaginationModelChange({ page: 2, pageSize: 10 });
        });

        act(() => {
            result.current.handleSortModelChange([{ field: 'name', sort: 'asc' }]);
        });

        act(() => {
            result.current.handleFilterModelChange({ items: [], quickFilterValues: ['name', 'A'] });
        });

        // Expect all calls to instantiate their own AbortController
        // 4 total calls, once on mount + 3 changes above
        expect(abortControllerMock).toHaveBeenCalledTimes(4);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Type-safe way to access mock results
        const controllers = abortControllerMock.mock.results.map((result) => result.value as MockAbortController);

        // Expect the first 3 to be aborted - only the last one (filter) will have successfully ran
        expect(controllers[0].abort).toHaveBeenCalledTimes(1);
        expect(controllers[1].abort).toHaveBeenCalledTimes(1);
        expect(controllers[2].abort).toHaveBeenCalledTimes(1);

        // Last one will be a success
        expect(controllers[3].abort).toHaveBeenCalledTimes(0);

        // Should have only called fetch 4 times total
        expect(global.fetch).toHaveBeenCalledTimes(4);
    });
});
