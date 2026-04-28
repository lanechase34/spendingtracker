import { useCallback } from 'react';

import useAuthContext from './useAuthContext';

interface PendingFetchParams {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    signal?: AbortSignal;
    additionalHeaders?: Record<string, string>;
    body?: object;
}

/**
 * Core fetch logic for pending token based requests.
 * Shared between usePendingFetch and usePending2FAFetch.
 * Returns null if no token defined yet
 */
function usePendingTokenFetch(
    token: string | null,
    clearToken: () => void,
    getCsrfToken: (token: string) => Promise<string | null>
) {
    /**
     * Fetch for 'unverfied' and 'pending2FAF' user secured API endpoints. Add's the users token to the header for the request
     * useCallback for stable function reference
     * @url secured url
     * @method http method
     * @fetchSignal abort signal
     * @additionalHeaders headers
     * @body body
     */
    return useCallback(
        async ({ url, method = 'GET', signal, additionalHeaders = {}, body }: PendingFetchParams) => {
            if (!token) return null;

            // For non-GET: ensure we have a CSRF token
            const useCsrf = method !== 'GET';
            const csrf = useCsrf ? await getCsrfToken(token) : null;

            const doFetch = async (csrfToken: string) => {
                const isFormData = body instanceof FormData;
                return fetch(url, {
                    method: method,
                    signal: signal,
                    headers: {
                        ...additionalHeaders,
                        Accept: 'application/json',
                        'x-auth-token': token,
                        ...(isFormData ? {} : { 'Content-Type': 'application/json' }), // Don't set content-type when sending formData
                        ...(useCsrf ? { 'x-csrf-token': csrfToken ?? '' } : {}), // add csrf token for non-get request
                    },
                    body: isFormData ? body : body ? JSON.stringify(body) : undefined, // try formData first, then json body, else nothing
                });
            };

            const response = await doFetch(csrf ?? '');

            // Unauthorized - clear the token
            // Invalid CSRF (session expired)
            if (response.status === 401 || (response.status === 403 && useCsrf)) {
                clearToken();
            }

            return response;
        },
        [token, getCsrfToken, clearToken]
    );
}

/**
 * Fetch for unverified user secured endpoints using pendingToken.
 * Returns null if no pending token defined.
 */
export default function usePendingFetch() {
    const { pendingToken, getCsrfToken, setPendingToken } = useAuthContext();

    const clearToken = useCallback(() => setPendingToken(null), [setPendingToken]);

    return usePendingTokenFetch(pendingToken, clearToken, getCsrfToken);
}

/**
 * Fetch for Pending2FA secured endpoints using pending2FAToken.
 * Returns null if no pending 2FA token defined.
 */
export function usePending2FAFetch() {
    const { pending2FAToken, getCsrfToken, setPending2FAToken } = useAuthContext();

    const clearToken = useCallback(() => setPending2FAToken(null), [setPending2FAToken]);

    return usePendingTokenFetch(pending2FAToken, clearToken, getCsrfToken);
}
