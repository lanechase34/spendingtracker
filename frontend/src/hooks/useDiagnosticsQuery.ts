import { useQuery } from '@tanstack/react-query';
import type { Diagnostics } from 'types/DiagnosticsResponse.type';
import { DiagnosticsResponseSchema } from 'types/DiagnosticsResponse.type';
import { API_BASE_URL } from 'utils/constants';
import { safeJson } from 'utils/safeJson';

import useAuthFetch from './useAuthFetch';

/**
 * Fetches the slower changing server diagnostics (app info, disk, postgres internals)
 * Polled instead of pushed over the metrics socket - the server caches it for 30s
 * Every widget using this hook shares the same query
 */
export default function useDiagnosticsQuery() {
    const authFetch = useAuthFetch();

    return useQuery({
        queryKey: ['diagnostics'],
        queryFn: async ({ signal }): Promise<Diagnostics> => {
            const response = await authFetch({
                url: `${API_BASE_URL}/admin/diagnostics`,
                method: 'GET',
                signal: signal,
            });

            if (response?.ok !== true) {
                throw new Error('Invalid network response');
            }

            const json = await safeJson(response);
            const parsed = DiagnosticsResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new Error('Invalid response format');
            }

            const result = parsed.data;

            if (result.error) {
                throw new Error(result.messages[0] ?? 'Server error');
            }

            return result.data;
        },
        staleTime: 1000 * 30,
        refetchInterval: 1000 * 60,
    });
}
