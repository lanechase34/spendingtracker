import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import useAuthFetch from './useAuthFetch';
import { incomeService } from 'schema/income';
import { queryKeys } from 'utils/queryKeys';

interface UseIncomeQueryProps {
    startDate: string;
    endDate: string;
    enabled?: boolean;
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
            const queryString = new URLSearchParams({ startDate, endDate }).toString();
            return await service.fetchIncome(queryString, signal);
        },
        enabled,
    });
}

/**
 * Mutator for handling update income requests
 */
export function useUpdateIncome() {
    const authFetch = useAuthFetch();
    const queryClient = useQueryClient();
    const service = useMemo(() => incomeService(authFetch), [authFetch]);

    return useMutation({
        mutationFn: (body: { date: string; pay: string; extra: string }) => service.updateIncome(body),
        onSuccess: () => {
            // Invalidate all income queries
            void queryClient.invalidateQueries({ queryKey: ['income'] });
        },
    });
}
