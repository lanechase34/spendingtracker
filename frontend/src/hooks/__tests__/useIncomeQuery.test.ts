import { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@test-utils';
import { act, waitFor } from '@testing-library/react';
import useAuthFetch from 'hooks/useAuthFetch';
import { useFetchExtraIncome, useFetchIncome, useSaveIncomeChanges } from 'hooks/useIncomeQuery';
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

    describe('useFetchExtraIncome', () => {
        const entries = [{ id: 1, date: '2026-03-15', amount: 250, description: 'Freelance' }];

        it('Should fetch extra income entries for the date range and return them', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(200, { error: false, data: entries }));

            const { result } = renderHook(() => useFetchExtraIncome(range), { queryClient });

            await waitFor(() => {
                expect(result.current.isSuccess).toBe(true);
            });
            expect(result.current.data).toEqual(entries);
            expect(queryClient.getQueryData(queryKeys.incomeExtra(range))).toEqual(entries);
            expect(mockAuthFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/income/extra?startDate=2026-03-01&endDate=2026-03-31`,
                method: 'GET',
                signal: expect.any(AbortSignal) as AbortSignal,
            });
        });

        it('Should report an error when the body is malformed', async () => {
            mockAuthFetch.mockResolvedValue(mockResponse(200, { error: false, data: { pay: 1 } }));

            const { result } = renderHook(() => useFetchExtraIncome(range), { queryClient });

            await waitFor(() => {
                expect(result.current.isError).toBe(true);
            });
        });

        it('Should not fetch while disabled', () => {
            const { result } = renderHook(() => useFetchExtraIncome({ ...range, enabled: false }), { queryClient });

            expect(result.current.fetchStatus).toBe('idle');
            expect(mockAuthFetch).not.toHaveBeenCalled();
        });
    });

    describe('useSaveIncomeChanges', () => {
        const pay = { date: '03-01-2026', pay: '4000' };
        const freelance = { date: '03-15-2026', amount: '250', description: 'Freelance' };
        const added = [freelance, { date: '03-20-2026', amount: '75.50', description: 'Gift' }];

        interface FetchArgs {
            url: string;
            method: string;
            body?: { description?: string };
        }

        /**
         * Respond per request, failing the requests matched by shouldFail
         */
        function respond(shouldFail: (args: FetchArgs) => boolean = () => false) {
            mockAuthFetch.mockImplementation((args: FetchArgs) => {
                if (shouldFail(args)) {
                    return Promise.resolve(mockResponse(500, { error: true, messages: ['bad'] }));
                }
                if (args.method === 'POST') {
                    return Promise.resolve(mockResponse(200, { error: false, data: { id: 9 } }));
                }
                if (args.url.includes('/income/extra?')) {
                    return Promise.resolve(mockResponse(200, { error: false, data: [] }));
                }
                if (args.method === 'GET') {
                    return Promise.resolve(mockResponse(200, { error: false, data: { pay: 1, extra: 0 } }));
                }
                return Promise.resolve(mockResponse(200, { error: false }));
            });
        }

        it('Should send only the requests for what changed', async () => {
            respond();

            const { result } = renderHook(() => useSaveIncomeChanges(), { queryClient });
            await act(() => result.current.mutateAsync({ pay: undefined, added: [freelance], removed: [] }));

            expect(mockAuthFetch).toHaveBeenCalledTimes(1);
            expect(mockAuthFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/income/extra`,
                method: 'POST',
                body: freelance,
            });
        });

        it('Should PUT pay, POST each new entry, DELETE each removed entry and report no failures', async () => {
            respond();
            const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

            const { result } = renderHook(() => useSaveIncomeChanges(), { queryClient });
            let outcome: unknown;
            await act(async () => {
                outcome = await result.current.mutateAsync({ pay, added, removed: [4, 5] });
            });

            expect(outcome).toEqual({ payFailed: false, failedAdds: [], failedRemovals: [] });
            expect(mockAuthFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/income`, method: 'PUT', body: pay });
            added.forEach((body) => {
                expect(mockAuthFetch).toHaveBeenCalledWith({
                    url: `${API_BASE_URL}/income/extra`,
                    method: 'POST',
                    body,
                });
            });
            [4, 5].forEach((id) => {
                expect(mockAuthFetch).toHaveBeenCalledWith({
                    url: `${API_BASE_URL}/income/extra/${String(id)}`,
                    method: 'DELETE',
                    signal: undefined,
                });
            });
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income'] });
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['incomeWaterfallChart'] });
        });

        it('Should report exactly which requests failed and still refresh', async () => {
            respond(
                ({ url, method, body }) =>
                    method === 'PUT' || body?.description === 'Gift' || url.endsWith('/income/extra/5')
            );
            const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

            const { result } = renderHook(() => useSaveIncomeChanges(), { queryClient });
            let outcome: unknown;
            await act(async () => {
                outcome = await result.current.mutateAsync({ pay, added, removed: [4, 5] });
            });

            expect(outcome).toEqual({ payFailed: true, failedAdds: [1], failedRemovals: [5] });
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income'] });
            expect(invalidate).toHaveBeenCalledWith({ queryKey: ['incomeWaterfallChart'] });
        });

        it('Should refetch cached totals and extra entries once the save finishes', async () => {
            respond();
            const totals = renderHook(() => useFetchIncome(range), { queryClient });
            const extras = renderHook(() => useFetchExtraIncome(range), { queryClient });
            await waitFor(() => {
                expect(totals.result.current.isSuccess && extras.result.current.isSuccess).toBe(true);
            });
            const callsBefore = mockAuthFetch.mock.calls.length;

            const { result } = renderHook(() => useSaveIncomeChanges(), { queryClient });
            await act(() => result.current.mutateAsync({ pay, added: [], removed: [] }));

            // The PUT and both refetches, already done by the time mutateAsync resolves
            expect(mockAuthFetch.mock.calls).toHaveLength(callsBefore + 3);
        });
    });
});
