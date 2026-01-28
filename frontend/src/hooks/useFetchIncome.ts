import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import useAuthFetch from 'hooks/useAuthFetch';
import { incomeService, Income } from 'schema/income';

/**
 * useFetchIncome Props
 */
interface FetchIncomeProps {
    additionalParams?: Record<string, string>;
    skip?: boolean;
}

/**
 * Hook Return Format
 */
interface UseFetchIncomeReturn {
    data: Income | null;
    loading: boolean;
    error: string | null;
    refetch: (signal?: AbortSignal) => Promise<void>;
}

/**
 * Handles fetching new income data when the startDate or endDate change
 * @additionalParams
 * Typically called with
 * @additionalParams.startDate in format YYYY-MM
 * @additionalParams.endDate in format YYYY-MM
 */
export default function useFetchIncome({
    additionalParams = {},
    skip = false,
}: FetchIncomeProps): UseFetchIncomeReturn {
    const [data, setData] = useState<Income | null>(null);
    const [loading, setLoading] = useState<boolean>(!skip);
    const [error, setError] = useState<string | null>(null);

    const authFetch = useAuthFetch();
    const service = useMemo(() => incomeService(authFetch), [authFetch]);

    /**
     * Create stable reference to the additonal params query string
     */
    const queryString = useMemo(() => new URLSearchParams(additionalParams).toString(), [additionalParams]);

    /**
     * Fetch when params change
     * Skip the fetch if needed
     * Aborts the previous fetch if re-triggered
     */
    useEffect(() => {
        if (skip) return;

        const controller = new AbortController();

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const result = await service.fetchIncome(queryString, controller.signal);
                setData(result);
                setLoading(false);
            } catch (err: unknown) {
                const errorInfo = err as { name?: string; message?: string };
                if (errorInfo.name !== 'AbortError') {
                    console.error('Error fetching income:', err);
                    setError(errorInfo.message ?? 'Unexpected error');
                    setLoading(false);
                }
            }
        }

        void load();

        return () => controller.abort();
    }, [queryString, skip, service]);

    const refetchAbortControllerRef = useRef<AbortController | null>(null);

    const refetch = useCallback(async () => {
        if (refetchAbortControllerRef.current) {
            refetchAbortControllerRef.current.abort();
        }
        const controller = new AbortController();
        refetchAbortControllerRef.current = controller;

        try {
            const result = await service.fetchIncome(queryString, controller.signal);
            setData(result);
        } catch (err: unknown) {
            const errorInfo = err as { name?: string; message?: string };
            if (errorInfo.name !== 'AbortError') {
                setError(errorInfo.message ?? 'Unexpected error');
            }
        }
    }, [queryString, service]);

    return {
        data,
        loading,
        error,
        refetch,
    };
}
