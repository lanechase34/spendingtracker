import { useQueryClient } from '@tanstack/react-query';
import useLocalStorage from 'hooks/useLocalStorage';
import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AuthContextType, PendingVerification } from 'types/AuthContext.type';
import { clearCategoryCache } from 'utils/categoryCache';
import { API_BASE_URL } from 'utils/constants';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * /csrf API return format
 */
const CSRFAPIResponseSchema = validateAPIResponse(
    z.object({
        csrf_token: z.string().min(2),
    })
);

/**
 * /security/refresh API return format
 */
const RefreshAPIResponseSchema = validateAPIResponse(
    z.object({
        access_token: z.string().min(2),
    })
);

/**
 * Module level so useLocalStorage receives a stable schema reference
 */
const WasAuthenticatedSchema = z.boolean();

/**
 * Context is managed inside provider, use hook when needed access
 * AuthContext to store the following:
 *
 * authToken
 * refreshToken
 *
 * Routes overview
 * /login -> returns JWT (json payload) and refresh token (secure cookie)
 * /security/logout -> Invalidates JWT and refresh token
 * /csrf -> Generates CSRF token for all non-get requests
 * /security/refreshtoken -> Takes refresh token (secure cookie) and returns new JWT (json payload) and refresh token
 */
export const AuthContextProvider = ({ children }: { children: ReactNode }) => {
    const queryClient = useQueryClient();

    /**
     * Store JWT for user
     */
    const [authToken, setAuthToken] = useState<string | null>(null);

    /**
     * Ref to access latest JWT
     */
    const authTokenRef = useRef<string | null>(null);

    /**
     * Stores the credentials of an unverified user so the verify dialog can send them
     * Kept in memory only - never persisted to storage
     */
    const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);

    /**
     * Stores a pending 2fa token for a user who still needs to enter a 2fa code
     */
    const [pending2FAToken, setPending2FAToken] = useState<string | null>(null);

    /**
     * CSRF token and the JWT it was issued for. A CSRF token is only valid for its JWT,
     * so a cached token is only reused when the JWT matches (refresh, 2FA, and verify logins all change the JWT)
     * Kept in refs only - no component renders from it, so it shouldn't re-render context consumers
     */
    const csrfTokenRef = useRef<string | null>(null);
    const csrfTokenOwnerRef = useRef<string | null>(null);

    /**
     * Ensures only one fetch is made for CSRF token per JWT
     */
    const csrfPromiseRef = useRef<Promise<string | null> | null>(null);
    const csrfPromiseOwnerRef = useRef<string | null>(null);
    const csrfRequestIdRef = useRef<number>(0);

    /**
     * Incremented on logout so in-flight refreshes started before the logout are discarded
     */
    const authGenerationRef = useRef<number>(0);

    /**
     * Track whether this request was just 'logged in' - not logged in via refresh token
     */
    const [userJustLoggedIn, setUserJustLoggedIn] = useState<boolean>(false);

    /**
     * Track when the refresh token is loading
     * and only allow one refresh to be in flight at once
     */
    const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

    /**
     * Track if this user was previously authenticated successfully
     * This persists across sessions and prevents unnecessary refresh calls for first-time visitors
     */
    const [wasAuthenticated, setWasAuthenticated] = useLocalStorage<boolean>({
        key: 'wasAuthenticated',
        initialValue: false,
        schema: WasAuthenticatedSchema,
    });

    /**
     * Track if we've completed the initial auth check (refresh attempt or skip)
     */
    const [hasCompletedInitialCheck, setHasCompletedInitialCheck] = useState<boolean>(false);

    /**
     * Wrapper functions that update both state and ref synchronously
     */
    const updateAuthToken = useCallback(
        (token: string | null) => {
            authTokenRef.current = token; // Update ref first
            setAuthToken(token); // Then update state

            // Update wasAuthenticated flag when we get a valid token
            if (token != null) {
                setWasAuthenticated(true);
            }
        },
        [setWasAuthenticated]
    );

    const updateCsrfToken = useCallback((token: string | null, owner: string | null = null) => {
        csrfTokenRef.current = token;
        csrfTokenOwnerRef.current = token == null ? null : owner;
    }, []);

    /**
     * Reset the state on logout
     */
    const logout = useCallback(() => {
        authGenerationRef.current++;
        refreshPromiseRef.current = null;
        updateAuthToken(null);
        updateCsrfToken(null);
        setPendingVerification(null);
        setPending2FAToken(null);
        setWasAuthenticated(false);
        setUserJustLoggedIn(false);

        // Clear all queries and the per-user category cache
        queryClient.clear();
        clearCategoryCache();
    }, [updateAuthToken, updateCsrfToken, queryClient, setWasAuthenticated]);

    /**
     * GET /csrf
     * Generate a CSRF token using the user's JWT
     * @returns the CSRF token generated
     */
    const getCsrfToken = useCallback(
        async (token: string, forceNew = false): Promise<string | null> => {
            // If a token for this JWT already exists, return it
            if (!forceNew && csrfTokenRef.current != null && csrfTokenOwnerRef.current === token) {
                return csrfTokenRef.current;
            }

            // If there's already a request in flight for this JWT, return that promise
            if (csrfPromiseRef.current && csrfPromiseOwnerRef.current === token) {
                return csrfPromiseRef.current;
            }

            const requestId = ++csrfRequestIdRef.current;
            const promise = (async () => {
                try {
                    const response = await fetch(`${API_BASE_URL}/csrf`, {
                        method: 'GET',
                        headers: {
                            'x-auth-token': token,
                        },
                    });

                    if (!response.ok) {
                        logout();
                        return null;
                    }

                    // Validate the response data
                    const json = await safeJson(response);
                    const parsed = CSRFAPIResponseSchema.safeParse(json);

                    if (!parsed.success) {
                        throw new Error('CSRF Validation failed: Invalid response format');
                    }

                    const result = parsed.data;

                    // Check errors
                    if (result.error) {
                        throw new Error('Error logging in. Please try again in a few minutes.');
                    }

                    const newCsrfToken = result.data.csrf_token;
                    updateCsrfToken(newCsrfToken, token);
                    return newCsrfToken;
                } catch (error) {
                    if (csrfTokenOwnerRef.current === token) {
                        updateCsrfToken(null);
                    }
                    throw error;
                } finally {
                    // Always clear the promise when done (success or failure), unless a newer request replaced it
                    if (csrfRequestIdRef.current === requestId) {
                        csrfPromiseRef.current = null;
                        csrfPromiseOwnerRef.current = null;
                    }
                }
            })();

            csrfPromiseRef.current = promise;
            csrfPromiseOwnerRef.current = token;
            return promise;
        },
        [logout, updateCsrfToken]
    );

    /**
     * Sets the auth token, sets the flag that the user just logged in, and fetches the csrf token immediately
     */
    const login = useCallback(
        async (token: string | null) => {
            updateAuthToken(token);
            setUserJustLoggedIn(true);

            // Get CSRF token immediately
            if (token != null) {
                await getCsrfToken(token);
            }
        },
        [getCsrfToken, updateAuthToken]
    );

    /**
     * Completes the 2FA login process
     */
    const complete2FALogin = useCallback(
        async (token: string) => {
            // Clear the pending token only once logged in - Verify2FADialog logs out if it sees
            // no pending token while still open, which would happen during login's CSRF fetch
            await login(token);
            setPending2FAToken(null);
        },
        [login]
    );

    /**
     * Resets the user just logged in flag
     */
    const clearUserJustLoggedIn = useCallback(() => {
        setUserJustLoggedIn(false);
    }, []);

    /**
     * POST /security/refreshtoken
     * Refreshes the JWT using the user's refresh token (stored in cookie)
     * @returns token or null
     */
    const refreshToken = useCallback(async (): Promise<string | null> => {
        // If there's already a refresh in flight, return that promise
        if (refreshPromiseRef.current) {
            return refreshPromiseRef.current;
        }

        // A logout while this refresh is in flight invalidates its result
        const generation = authGenerationRef.current;
        const isStale = () => generation !== authGenerationRef.current;

        const promise = (async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/security/refreshtoken`, {
                    method: 'POST',
                    credentials: 'include', // x-refresh-token added as cookie automatically (matches path)
                });

                if (isStale()) return null;

                if (!response.ok) {
                    logout();
                    return null;
                }

                // Validate the response data
                const json = await safeJson(response);
                const parsed = RefreshAPIResponseSchema.safeParse(json);

                if (isStale()) return null;

                if (!parsed.success) {
                    setWasAuthenticated(false);
                    return null;
                }

                const result = parsed.data;

                // Check errors
                if (result.error) {
                    setWasAuthenticated(false);
                    return null;
                }

                const newToken = result.data.access_token;
                updateAuthToken(newToken); // update context

                // Get a new CSRF token for the new JWT
                await getCsrfToken(newToken);
                return isStale() ? null : newToken;
            } finally {
                // After a logout the ref already belongs to a newer refresh (or was cleared)
                if (!isStale()) {
                    refreshPromiseRef.current = null;
                }
            }
        })();

        refreshPromiseRef.current = promise;
        return promise;
    }, [logout, getCsrfToken, updateAuthToken, setWasAuthenticated]);

    // Getter for the latest ref value
    const getLatestAuthToken = useCallback(() => {
        return authTokenRef.current;
    }, []);

    /**
     * Check if we're still in the initial authentication check phase
     */
    const isInitializing = useCallback(() => {
        return !hasCompletedInitialCheck;
    }, [hasCompletedInitialCheck]);

    /**
     * Track if we've attempted the initial refresh to ensure it only happens once
     */
    const hasAttemptedInitialRefreshRef = useRef<boolean>(false);

    /**
     * Attempt to restore auth on page load by using refresh token
     * ONLY if user was previously authenticated
     */
    useEffect(() => {
        if (hasAttemptedInitialRefreshRef.current) {
            return;
        }
        hasAttemptedInitialRefreshRef.current = true;

        // If user was never authenticated, skip the refresh attempt entirely
        if (!wasAuthenticated) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- the initial auth check completes immediately when there is nothing to refresh
            setHasCompletedInitialCheck(true);
            return;
        }

        refreshToken()
            .catch(() => {
                setWasAuthenticated(false); // refresh failed
            })
            .finally(() => {
                setHasCompletedInitialCheck(true);
            });
    }, [wasAuthenticated, refreshToken, setWasAuthenticated]);

    /**
     * Memoize the entire context value to prevent unnecessary re-renders
     */
    const value = useMemo<AuthContextType>(() => {
        return {
            authToken: authToken,
            getLatestAuthToken: getLatestAuthToken,
            login: login,
            logout: logout,
            refreshToken: refreshToken,
            getCsrfToken: getCsrfToken,
            userJustLoggedIn: userJustLoggedIn,
            clearUserJustLoggedIn: clearUserJustLoggedIn,

            // Pending verification
            pendingVerification: pendingVerification,
            setPendingVerification: setPendingVerification,

            // Pending 2FA verification
            pending2FAToken: pending2FAToken,
            setPending2FAToken: setPending2FAToken,
            complete2FALogin: complete2FALogin,

            isInitializing: isInitializing,
        };
    }, [
        authToken,
        getLatestAuthToken,
        login,
        logout,
        refreshToken,
        getCsrfToken,
        userJustLoggedIn,
        clearUserJustLoggedIn,
        pendingVerification,
        setPendingVerification,
        pending2FAToken,
        setPending2FAToken,
        complete2FALogin,
        isInitializing,
    ]);

    return <AuthContext value={value}>{children}</AuthContext>;
};
