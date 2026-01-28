import { useCallback } from 'react';
import useAuthContext from './useAuthContext';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

interface AuthFetchParams {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    signal?: AbortSignal;
    additionalHeaders?: Record<string, string>;
    body?: object;
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
            if (!currentAuthToken) return null;

            // For non-GET: ensure we have a CSRF token
            const useCsrf = method !== 'GET';
            const csrf = useCsrf ? await getCsrfToken(currentAuthToken) : null;

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

            let response = await doFetch(currentAuthToken, csrf ?? '');

            // Unauthorized - attempt refresh
            if (response.status === 401) {
                const newToken = await refreshToken();

                // Refresh failed
                if (!newToken) {
                    logout();
                    return response;
                }

                // For non-GET requests, get fresh CSRF token after refresh
                let newCsrf: string | null = '';
                if (useCsrf) {
                    newCsrf = await getCsrfToken(newToken, true);
                }

                // Retry
                response = await doFetch(newToken, newCsrf ?? '');

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
                const parsed = validateAPIResponse(z.null().optional()).safeParse(json);

                // Invalid response or not csrf error
                if (!parsed.success || !parsed.data?.messages?.some((m) => m.toLowerCase().includes('csrf'))) {
                    return response;
                }

                // Get the latest token again in case it changed
                const latestToken = getLatestAuthToken();
                if (!latestToken) {
                    logout();
                    return response;
                }

                // Get new CSRF token
                const newCsrf = await getCsrfToken(latestToken, true);

                // CSRF token fetch failed
                if (!newCsrf) {
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

            return response;
        },
        [getLatestAuthToken, getCsrfToken, refreshToken, logout]
    );

    return authFetch;
}
