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
 * Fetch's secured endpoints using user's JWT - only for unverified users only.
 * Does not interfere with the authToken flowchart
 * Returns null if no token defined yet
 */
export default function usePendingFetch() {
    const { pendingToken, getCsrfToken, setPendingToken } = useAuthContext();

    /**
     * Fetch for 'unverfied' user secured API endpoints. Add's the users pendingToken to the header for the request
     * useCallback for stable function reference unless pendingToken changes
     * @url secured url
     * @method http method
     * @fetchSignal abort signal
     * @additionalHeaders headers
     * @body body
     *
     * Attempts to refetch the JWT if the user gets a 401 (unauthorized) error returned
     */
    const pendingFetch = useCallback(
        async ({ url, method = 'GET', signal, additionalHeaders = {}, body }: PendingFetchParams) => {
            if (!pendingToken) return null;

            // For non-GET: ensure we have a CSRF token
            const useCsrf = method !== 'GET';
            const csrf = useCsrf ? await getCsrfToken(pendingToken) : null;

            const doFetch = async (token: string, csrfToken: string) => {
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

            const response = await doFetch(pendingToken, csrf ?? '');

            // Unauthorized - blank the pending token
            // Invalid CSRF (session expired)
            if (response.status === 401 || (response.status === 403 && useCsrf)) {
                setPendingToken(null);
            }

            return response;
        },
        [pendingToken, getCsrfToken, setPendingToken]
    );

    return pendingFetch;
}
