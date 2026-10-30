import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { incomeService } from 'schema/income';
import type { SaveIncomeExtraBody, UpdateIncomeBody } from 'types/Income.type';
import { queryKeys } from 'utils/queryKeys';

import useAuthFetch from './useAuthFetch';

interface UseIncomeQueryProps {
    startDate: string;
    endDate: string;
    enabled?: boolean;
}

/**
 * Invalidate every income query (totals + extra entries) and the widgets built from income
 */
function invalidateIncome(queryClient: QueryClient) {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['income'] }),
        queryClient.invalidateQueries({ queryKey: ['incomeWaterfallChart'] }),
    ]);
}

/**
 * Handles fetching new income data
 */
export function useFetchIncome({ startDate, endDate, enabled = true }: UseIncomeQueryProps) {
    const authFetch = useAuthFetch();
    const service = useMemo(() => incomeService(authFetch), [authFetch]);

    return useQuery({
        queryKey: queryKeys.income({ startDate, endDate }),
        queryFn: async ({ signal }) => {
            const queryString = new URLSearchParams({
                startDate,
                endDate,
            }).toString();
            return await service.fetchIncome(queryString, signal);
        },
        enabled,
    });
}

/**
 * Handles fetching the individual extra income entries
 */
export function useFetchExtraIncome({ startDate, endDate, enabled = true }: UseIncomeQueryProps) {
    const authFetch = useAuthFetch();
    const service = useMemo(() => incomeService(authFetch), [authFetch]);

    return useQuery({
        queryKey: queryKeys.incomeExtra({ startDate, endDate }),
        queryFn: async ({ signal }) => {
            const queryString = new URLSearchParams({
                startDate,
                endDate,
            }).toString();
            return await service.fetchExtraIncome(queryString, signal);
        },
        enabled,
    });
}

interface IncomeChanges {
    pay: UpdateIncomeBody | undefined;
    added: SaveIncomeExtraBody[];
    removed: number[];
}

interface IncomeChangesResult {
    payFailed: boolean;
    failedAdds: number[]; // indexes into IncomeChanges.added
    failedRemovals: number[]; // ids from IncomeChanges.removed
}

/**
 * Resolve true/false instead of throwing so one failed request doesn't hide the outcome of the others
 */
function settled(promise: Promise<unknown>) {
    return promise.then(
        () => true,
        (err: unknown) => {
            console.error('Error saving income change:', err);
            return false;
        }
    );
}

/**
 * Mutator for saving every pending income change (monthly pay, new extra entries, removed extra entries) at once
 * Each request settles independently and the result reports which ones failed so the caller can retry only those
 * Income queries are refreshed once at the end, regardless of the outcome, since some requests may have succeeded
 */
export function useSaveIncomeChanges() {
    const authFetch = useAuthFetch();
    const queryClient = useQueryClient();
    const service = useMemo(() => incomeService(authFetch), [authFetch]);

    return useMutation({
        mutationFn: async ({ pay, added, removed }: IncomeChanges): Promise<IncomeChangesResult> => {
            const [paySaved, addsSaved, removalsSaved] = await Promise.all([
                pay ? settled(service.updateIncome(pay)) : Promise.resolve(true),
                Promise.all(added.map((body) => settled(service.saveExtraIncome(body)))),
                Promise.all(removed.map((id) => settled(service.deleteExtraIncome(id)))),
            ]);

            return {
                payFailed: !paySaved,
                failedAdds: added.flatMap((_, index) => (addsSaved[index] === true ? [] : [index])),
                failedRemovals: removed.filter((_, index) => removalsSaved[index] !== true),
            };
        },
        onSettled: () => invalidateIncome(queryClient),
    });
}
