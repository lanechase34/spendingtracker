import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@test-utils';
import { act, waitFor } from '@testing-library/react';
import useAuthFetch from 'hooks/useAuthFetch';
import { useFetchIncome, useUpdateIncome } from 'hooks/useIncomeQuery';
import { API_BASE_URL } from 'utils/constants';
import { queryKeys } from 'utils/queryKeys';

jest.mock('hooks/useAuthFetch');
const mockAuthFetch = jest.fn();
(useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);

function mockResponse(status: number, body?: unknown) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    };
}

const range = { startDate: '2026-03-01', endDate: '2026-03-31' };

describe('useIncomeQuery', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthFetch.mockReset();
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    });

    afterEach(() => {
        queryClient.clear();
    });

    describe('useFetchIncome', () => {
        it('Should fetch income for the date range and return it', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(200, { error: false, data: { pay: 4000, extra: 250 } }));

            const { result } = renderHook(() => useFetchIncome(range), { queryClient });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(result.current.data).toEqual({ pay: 4000, extra: 250 });
            expect(mockAuthFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/income?startDate=2026-03-01&endDate=2026-03-31`,
                method: 'GET',
                signal: expect.any(AbortSignal) as AbortSignal,
            });
        });

        it('Should cache the result under the income key for the range', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(200, { error: false, data: { pay: 1, extra: 2 } }));

            const { result } = renderHook(() => useFetchIncome(range), { queryClient });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(queryClient.getQueryData(queryKeys.income(range))).toEqual({ pay: 1, extra: 2 });
        });

        it.each([
            ['the response is not ok', mockResponse(500, {})],
            ['the body is malformed', mockResponse(200, { error: false, data: { pay: 'lots' } })],
            ['there is no response', null],
        ])('Should report an error when %s', async (_label, response) => {
            mockAuthFetch.mockResolvedValue(response);

            const { result } = renderHook(() => useFetchIncome(range), { queryClient });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
            expect(result.current.data).toBeUndefined();
        });

        it('Should not fetch while disabled', () => {
            const { result } = renderHook(() => useFetchIncome({ ...range, enabled: false }), { queryClient });

            expect(result.current.fetchStatus).toBe('idle');
            expect(mockAuthFetch).not.toHaveBeenCalled();
        });
    });

    describe('useUpdateIncome', () => {
        const body = { date: '2026-03', pay: '4000', extra: '250' };

        it('Should PUT the income and invalidate every income query', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(200, { error: false }));
            const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

            const { result } = renderHook(() => useUpdateIncome(), { queryClient });
            await act(() => result.current.mutateAsync(body));

            expect(mockAuthFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/income`, method: 'PUT', body });
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income'] });
        });

        it('Should refetch cached income for other ranges after saving', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(200, { error: false, data: { pay: 1, extra: 0 } }));
            const fetched = renderHook(() => useFetchIncome(range), { queryClient });
            await waitFor(() => {
                expect(fetched.result.current.isSuccess).toBe(true);
            });
            const callsBefore = mockAuthFetch.mock.calls.length;

            const { result } = renderHook(() => useUpdateIncome(), { queryClient });
            await act(() => result.current.mutateAsync(body));

            await waitFor(() => {
                expect(mockAuthFetch.mock.calls).toHaveLength(callsBefore + 2); // the PUT and the refetch
            });
        });

        it.each([
            ['a non-ok status, even with a body claiming success', mockResponse(500, { error: false })],
            ['an ok status with an error body', mockResponse(200, { error: true, messages: ['bad'] })],
            ['no response', null],
        ])('Should fail and leave the cache alone for %s', async (_label, response) => {
            mockAuthFetch.mockResolvedValue(response);
            const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

            const { result } = renderHook(() => useUpdateIncome(), { queryClient });
            await act(async () => {
                await result.current.mutateAsync(body).catch(() => undefined);
            });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
            expect(invalidate).not.toHaveBeenCalled();
        });
    });
});
