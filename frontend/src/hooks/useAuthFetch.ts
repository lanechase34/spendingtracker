import { useCallback } from 'react';
import { safeJson } from 'utils/safeJson';
import { NoDataAPIResponseSchema } from 'validators/validateAPIResponse';

import useAuthContext from './useAuthContext';

interface AuthFetchParams {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    signal?: AbortSignal | undefined;
    additionalHeaders?: Record<string, string>;
    body?: Record<string, unknown> | FormData | undefined;
}

/**
 * Fetch's secured endpoints using user's JWT
 * Returns null if no token defined yet
 */
export default function useAuthFetch() {
    const { getLatestAuthToken, getCsrfToken, logout, refreshToken } = useAuthContext();

    /**
     * Fetch for secured API endpoints. Add's the users auth token to the header for the request
     * useCallback for stable function reference unless authToken changes
     * @url secured url
     * @method http method
     * @fetchSignal abort signal
     * @additionalHeaders headers
     * @body body
     *
     * Attempts to refetch the JWT if the user gets a 401 (unauthorized) error returned
     */
    const authFetch = useCallback(
        async ({ url, method = 'GET', signal, additionalHeaders = {}, body }: AuthFetchParams) => {
            const currentAuthToken = getLatestAuthToken();
            if (currentAuthToken == null) return null;

            // For non-GET: ensure we have a CSRF token
            const useCsrf = method !== 'GET';
            const csrf = useCsrf ? await getCsrfToken(currentAuthToken) : null;

            // If we need CSRF and we can't retrieve a valid CSRF token, logout
            if (useCsrf && csrf == null) {
                logout();
                return null;
            }

            const doFetch = async (token: string, csrfToken: string) => {
                const isFormData = body instanceof FormData;
                return fetch(url, {
                    method: method,
                    signal: signal ?? null,
                    headers: {
                        ...additionalHeaders,
                        Accept: 'application/json',
                        'x-auth-token': token,
                        ...(isFormData ? {} : { 'Content-Type': 'application/json' }), // Don't set content-type when sending formData
                        ...(useCsrf ? { 'x-csrf-token': csrfToken } : {}), // add csrf token for non-get request
                    },
                    body: isFormData ? body : body ? JSON.stringify(body) : null, // try formData first, then json body, else nothing
                });
            };

            let response = await doFetch(currentAuthToken, csrf ?? '');

            // Unauthorized - attempt refresh
            if (response.status === 401) {
                const newToken = await refreshToken();

                // Refresh failed
                if (newToken == null) {
                    logout();
                    return response;
                }

                // For non-GET requests, get fresh CSRF token after refresh
                let newCsrf: string | null = '';
                if (useCsrf) {
                    newCsrf = await getCsrfToken(newToken, true);
                    if (newCsrf == null) {
                        logout();
                        return response;
                    }
                }

                // Retry
                response = await doFetch(newToken, newCsrf);

                // If still 401, log user out
                if (response.status === 401) {
                    logout();
                    return response;
                }
            }

            // 403 - Check if CSRF error
            else if (response.status === 403 && useCsrf) {
                // If CSRF error, retry the CSRF token
                const json = await safeJson(response);
                const parsed = NoDataAPIResponseSchema.safeParse(json);

                // Invalid response or not csrf error
                if (!parsed.success || parsed.data.messages?.some((m) => m.toLowerCase().includes('csrf')) !== true) {
                    return response;
                }

                // Get the latest token again in case it changed
                const latestToken = getLatestAuthToken();
                if (latestToken == null) {
                    logout();
                    return response;
                }

                // Get new CSRF token
                const newCsrf = await getCsrfToken(latestToken, true);

                // CSRF token fetch failed
                if (newCsrf == null) {
                    logout();
                    return response;
                }

                // Retry
                response = await doFetch(latestToken, newCsrf);

                // If still 403, log user out
                if (response.status === 403) {
                    logout();
                    return response;
                }
            }

            // 502 any server error
            // Force logout the user - if the server restarted, the user's JWT would've became invalidated
            // If the server is down, we want to log the user out
            else if (response.status === 502) {
                logout();
                return response;
            }

            return response;
        },
        [getLatestAuthToken, getCsrfToken, refreshToken, logout]
    );

    return authFetch;
}
