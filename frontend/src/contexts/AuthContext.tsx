import { useQueryClient } from '@tanstack/react-query';
import useLocalStorage from 'hooks/useLocalStorage';
import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useRef,useState } from 'react';
import type { AuthContextType } from 'types/AuthContext.type';
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
     * Stores a pending token for an unverified user
     */
    const [pendingToken, setPendingToken] = useState<string | null>(null);

    /**
     *  Store CSRF Token
     */
    const [csrfToken, setCsrfToken] = useState<string | null>(null);

    /**
     * Ensures only one fetch is made for CSRF token
     * And, the csrfTokenRef so it's not needed as a dependency
     */
    const csrfPromiseRef = useRef<Promise<string | null> | null>(null);
    const csrfTokenRef = useRef<string | null>(null);

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
            if (token) {
                setWasAuthenticated(true);
            }
        },
        [setWasAuthenticated]
    );

    const updateCsrfToken = useCallback((token: string | null) => {
        csrfTokenRef.current = token; // Update ref first
        setCsrfToken(token); // Then update state
    }, []);

    /**
     * Reset the state on logout
     */
    const logout = useCallback(() => {
        updateAuthToken(null);
        updateCsrfToken(null);
        setPendingToken(null);
        setWasAuthenticated(false);
        setUserJustLoggedIn(false);

        // Clear all queries
        queryClient.clear();
    }, [updateAuthToken, updateCsrfToken, queryClient, setWasAuthenticated]);

    /**
     * GET /csrf
     * Generate a CSRF token using the user's JWT
     * @returns the CSRF token generated
     */
    const getCsrfToken = useCallback(
        async (token: string, forceNew = false) => {
            // If token already exists, return it
            if (!forceNew && csrfTokenRef.current) {
                return csrfTokenRef.current;
            }

            // If there's already a request in flight, return that promise
            if (csrfPromiseRef.current) {
                return csrfPromiseRef.current;
            }

            csrfPromiseRef.current = (async () => {
                try {
                    const response = await fetch('/spendingtracker/api/v1/csrf', {
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
                    updateCsrfToken(newCsrfToken);
                    return newCsrfToken;
                } finally {
                    // Always clear the promise when done (success or failure)
                    csrfPromiseRef.current = null;
                }
            })();

            return csrfPromiseRef.current;
        },
        [logout, updateCsrfToken]
    );

    const login = useCallback(
        async (token: string | null) => {
            updateAuthToken(token);
            setUserJustLoggedIn(true);

            // Get CSRF token immediately
            if (token) {
                await getCsrfToken(token);
            }
        },
        [getCsrfToken, updateAuthToken]
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

        refreshPromiseRef.current = (async () => {
            try {
                const response = await fetch('/spendingtracker/api/v1/security/refreshtoken', {
                    method: 'POST',
                    credentials: 'include', // x-refresh-token added as cookie automatically (matches path)
                });

                if (!response.ok) {
                    logout();
                    return null;
                }

                // Validate the response data
                const json = await safeJson(response);
                const parsed = RefreshAPIResponseSchema.safeParse(json);

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

                // Get a new CSRF token
                await getCsrfToken(newToken);
                return newToken;
            } finally {
                refreshPromiseRef.current = null;
            }
        })();

        return refreshPromiseRef.current;
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
     * Check if user is currently authenticated
     */
    const isAuthenticated = useCallback(() => {
        return authToken !== null;
    }, [authToken]);

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

    const value: AuthContextType = {
        authToken: authToken,
        getLatestAuthToken: getLatestAuthToken,
        login: login,
        logout: logout,
        refreshToken: refreshToken,
        csrfToken: csrfToken,
        getCsrfToken: getCsrfToken,
        userJustLoggedIn: userJustLoggedIn,
        clearUserJustLoggedIn: clearUserJustLoggedIn,
        pendingToken: pendingToken,
        setPendingToken: setPendingToken,
        isInitializing: isInitializing,
        isAuthenticated: isAuthenticated,
        wasAuthenticated: wasAuthenticated,
    };

    return <AuthContext value={value}>{children}</AuthContext>;
};
