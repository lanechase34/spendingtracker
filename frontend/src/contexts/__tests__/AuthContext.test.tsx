import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { AuthContextProvider } from 'contexts/AuthContext';
import useAuthContext from 'hooks/useAuthContext';
import type { ReactNode } from 'react';
import { clearCategoryCache } from 'utils/categoryCache';
import { API_BASE_URL } from 'utils/constants';

jest.mock('utils/categoryCache', () => ({
    clearCategoryCache: jest.fn(),
}));

// Mock useLocalStorage hook
const mockSetWasAuthenticated: jest.Mock = jest.fn();
const mockWasAuthenticated = { current: false };

jest.mock('hooks/useLocalStorage', () => ({
    __esModule: true,
    default: jest.fn(() => [mockWasAuthenticated.current, mockSetWasAuthenticated]),
}));

// Create wrapper with QueryClient
const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
            },
        },
    });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <AuthContextProvider>{children}</AuthContextProvider>
        </QueryClientProvider>
    );
};

describe('AuthContext', () => {
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockWasAuthenticated.current = false;

        global.fetch = jest.fn();
        mockFetch = global.fetch as jest.Mock;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Initial Mount - No Previous Authentication', () => {
        it('Should not attempt refresh when wasAuthenticated is false', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            // Wait for initial check to complete
            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Should not make any fetch calls
            expect(mockFetch).not.toHaveBeenCalled();
            expect(result.current.authToken).toBeNull();
            expect(result.current.authToken).toBeNull();
        });
    });

    describe('Initial Mount - Previous Authentication', () => {
        it('Should attempt refresh and succeed when wasAuthenticated is true', async () => {
            mockWasAuthenticated.current = true;

            // Mock successful refresh response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { access_token: 'new-access-token' },
                }),
            });

            // Mock successful CSRF response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'new-csrf-token' },
                }),
            });

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            // Should start initializing
            expect(result.current.isInitializing()).toBe(true);

            // Wait for refresh to complete
            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Verify refresh and CSRF calls were made
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenNthCalledWith(
                1,
                `${API_BASE_URL}/security/refreshtoken`,
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include',
                })
            );
            expect(mockFetch).toHaveBeenNthCalledWith(
                2,
                `${API_BASE_URL}/csrf`,
                expect.objectContaining({
                    method: 'GET',
                    headers: { 'x-auth-token': 'new-access-token' },
                })
            );

            // Verify state
            expect(result.current.authToken).toBe('new-access-token');
            await expect(result.current.getCsrfToken('new-access-token')).resolves.toBe('new-csrf-token');
            expect(mockFetch).toHaveBeenCalledTimes(2); // cached, no extra fetch
            expect(mockSetWasAuthenticated).toHaveBeenCalledWith(true);
        });

        it('Should handle refresh failure and clear wasAuthenticated', async () => {
            mockWasAuthenticated.current = true;

            // Mock failed refresh response
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
            });

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            expect(result.current.isInitializing()).toBe(true);

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            expect(result.current.authToken).toBeNull();
            expect(result.current.authToken).toBeNull();

            // Verify wasAuthenticated was cleared
            expect(mockSetWasAuthenticated).toHaveBeenCalledWith(false);
        });

        it('Should handle refresh with invalid response schema', async () => {
            mockWasAuthenticated.current = true;

            // Mock response with invalid schema
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { invalid_field: 'oops' }, // Missing access_token
                }),
            });

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            expect(result.current.authToken).toBeNull();
            expect(mockSetWasAuthenticated).toHaveBeenCalledWith(false);
        });

        it('Should handle refresh with error flag in response', async () => {
            mockWasAuthenticated.current = true;

            // Mock response with error flag
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: true,
                    data: { access_token: 'token' },
                }),
            });

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            expect(result.current.authToken).toBeNull();
            expect(mockSetWasAuthenticated).toHaveBeenCalledWith(false);
        });
    });

    describe('login()', () => {
        it('Should set authToken and fetch CSRF token on successful login', async () => {
            mockWasAuthenticated.current = false;

            // Mock successful CSRF response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'csrf-token-123' },
                }),
            });

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Call login
            await act(async () => {
                await result.current.login('login-token-456');
            });

            // Verify CSRF was fetched
            expect(mockFetch).toHaveBeenCalledWith(
                `${API_BASE_URL}/csrf`,
                expect.objectContaining({
                    method: 'GET',
                    headers: { 'x-auth-token': 'login-token-456' },
                })
            );

            expect(result.current.authToken).toBe('login-token-456');
            await expect(result.current.getCsrfToken('login-token-456')).resolves.toBe('csrf-token-123');
            expect(result.current.userJustLoggedIn).toBe(true);
            expect(mockSetWasAuthenticated).toHaveBeenCalledWith(true);
        });
    });

    describe('logout()', () => {
        it('Should clear all auth state and query cache', async () => {
            mockWasAuthenticated.current = true;

            // Mock successful refresh
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { access_token: 'token' },
                }),
            });

            // Mock successful CSRF
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'csrf' },
                }),
            });

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.authToken).toBe('token');
            });

            // Set pending verification credentials
            act(() => {
                result.current.setPendingVerification({ email: 'a@b.co', password: 'pw', codeSent: true });
            });

            expect(result.current.pendingVerification).toEqual({ email: 'a@b.co', password: 'pw', codeSent: true });

            // Logout
            act(() => {
                result.current.logout();
            });

            expect(result.current.authToken).toBeNull();
            expect(result.current.pendingVerification).toBeNull();
            expect(clearCategoryCache).toHaveBeenCalled();
            expect(result.current.userJustLoggedIn).toBe(false);
            expect(mockSetWasAuthenticated).toHaveBeenCalledWith(false);
        });
    });

    describe('getCsrfToken()', () => {
        it('Should return cached CSRF token if available', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Mock first CSRF fetch
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'cached-csrf' },
                }),
            });

            // First call - should fetch
            let csrfToken: string | null = null;
            await act(async () => {
                csrfToken = await result.current.getCsrfToken('test-token');
            });

            expect(csrfToken).toBe('cached-csrf');
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Second call - should use cache
            await act(async () => {
                csrfToken = await result.current.getCsrfToken('test-token');
            });

            expect(csrfToken).toBe('cached-csrf');
            expect(mockFetch).toHaveBeenCalledTimes(1); // No additional call
        });

        it('Should not reuse a CSRF token issued for a different JWT', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({ error: false, data: { csrf_token: 'pending-csrf' } }),
            });
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({ error: false, data: { csrf_token: 'real-csrf' } }),
            });

            // CSRF cached for the pending 2FA token
            await act(async () => {
                await result.current.getCsrfToken('pending-token');
            });

            // Completing login with the real JWT fetches a CSRF token for it
            await act(async () => {
                await result.current.complete2FALogin('real-token');
            });

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenLastCalledWith(
                `${API_BASE_URL}/csrf`,
                expect.objectContaining({ headers: { 'x-auth-token': 'real-token' } })
            );
            await expect(result.current.getCsrfToken('real-token')).resolves.toBe('real-csrf');
        });

        it('Should force fetch new CSRF token when forceNew is true', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // First fetch
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'first-csrf' },
                }),
            });

            await act(async () => {
                await result.current.getCsrfToken('test-token');
            });

            // Force new fetch
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'second-csrf' },
                }),
            });

            let newToken: string | null = null;
            await act(async () => {
                newToken = await result.current.getCsrfToken('test-token', true);
            });

            expect(newToken).toBe('second-csrf');
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('Should handle CSRF fetch failure and call logout', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Mock failed CSRF fetch
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
            });

            await act(async () => {
                await result.current.getCsrfToken('test-token');
            });

            // Should have logged out
            expect(result.current.authToken).toBeNull();
            expect(mockSetWasAuthenticated).toHaveBeenCalledWith(false);
        });

        it('Should handle invalid CSRF response schema', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { invalid: 'schema' },
                }),
            });

            await expect(
                act(async () => {
                    await result.current.getCsrfToken('test-token');
                })
            ).rejects.toThrow();
        });

        it('Should handle CSRF response with error flag', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: true,
                    data: { csrf_token: 'token' },
                }),
            });

            await expect(
                act(async () => {
                    await result.current.getCsrfToken('test-token');
                })
            ).rejects.toThrow();
        });

        it('Should deduplicate concurrent CSRF requests', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Mock CSRF fetch with delay
            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                json: () => ({
                                    error: false,
                                    data: { csrf_token: 'concurrent-csrf' },
                                }),
                            });
                        }, 50)
                    )
            );

            // Make two concurrent calls
            const [token1, token2] = await act(async () => {
                return await Promise.all([
                    result.current.getCsrfToken('test-token'),
                    result.current.getCsrfToken('test-token'),
                ]);
            });

            expect(token1).toBe('concurrent-csrf');
            expect(token2).toBe('concurrent-csrf');
            expect(mockFetch).toHaveBeenCalledTimes(1); // Only one request
        });
    });

    describe('refreshToken()', () => {
        it('Should successfully refresh token and get CSRF', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Mock refresh response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { access_token: 'refreshed-token' },
                }),
            });

            // Mock CSRF response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'refreshed-csrf' },
                }),
            });

            let token: string | null = null;
            await act(async () => {
                token = await result.current.refreshToken();
            });

            expect(token).toBe('refreshed-token');
            expect(result.current.authToken).toBe('refreshed-token');
            await expect(result.current.getCsrfToken('refreshed-token')).resolves.toBe('refreshed-csrf');
        });

        it('Should deduplicate concurrent refresh requests', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            // Mock refresh with delay
            mockFetch.mockImplementationOnce(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                json: () => ({
                                    error: false,
                                    data: { access_token: 'concurrent-refresh' },
                                }),
                            });
                        }, 50)
                    )
            );

            // Mock CSRF
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'csrf' },
                }),
            });

            // Make two concurrent calls
            const [token1, token2] = await act(async () => {
                return await Promise.all([result.current.refreshToken(), result.current.refreshToken()]);
            });

            expect(token1).toBe('concurrent-refresh');
            expect(token2).toBe('concurrent-refresh');
            // Should only make 2 calls total: 1 refresh + 1 CSRF (not 2 refresh + 2 CSRF)
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('Helper Methods', () => {
        it('Should track userJustLoggedIn and clear it', async () => {
            mockWasAuthenticated.current = false;

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'csrf' },
                }),
            });

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            await act(async () => {
                await result.current.login('token');
            });

            expect(result.current.userJustLoggedIn).toBe(true);

            act(() => {
                result.current.clearUserJustLoggedIn();
            });

            expect(result.current.userJustLoggedIn).toBe(false);
        });

        it('Should get latest auth token via ref', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            expect(result.current.getLatestAuthToken()).toBeNull();

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    error: false,
                    data: { csrf_token: 'csrf' },
                }),
            });

            await act(async () => {
                await result.current.login('latest-token');
            });

            expect(result.current.getLatestAuthToken()).toBe('latest-token');
        });

        it('Should manage pendingVerification state in memory only', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            expect(result.current.pendingVerification).toBeNull();

            act(() => {
                result.current.setPendingVerification({ email: 'a@b.co', password: 'secretpassword', codeSent: true });
            });

            expect(result.current.pendingVerification).toEqual({
                email: 'a@b.co',
                password: 'secretpassword',
                codeSent: true,
            });

            // Credentials are never written to browser storage
            expect(
                Object.keys(localStorage)
                    .map((key) => localStorage.getItem(key))
                    .join(' ')
            ).not.toContain('secretpassword');
            expect(
                Object.keys(sessionStorage)
                    .map((key) => sessionStorage.getItem(key))
                    .join(' ')
            ).not.toContain('secretpassword');
        });
    });

    describe('logout during refresh', () => {
        it('Should discard a refresh that resolves after logout', async () => {
            mockWasAuthenticated.current = false;

            const { result } = renderHook(() => useAuthContext(), {
                wrapper: createWrapper(),
            });

            await waitFor(() => {
                expect(result.current.isInitializing()).toBe(false);
            });

            let resolveRefresh: (value: unknown) => void = () => {
                /* replaced below */
            };
            mockFetch.mockReturnValueOnce(
                new Promise((resolve) => {
                    resolveRefresh = resolve;
                })
            );

            let refreshPromise: Promise<string | null> = Promise.resolve(null);
            act(() => {
                refreshPromise = result.current.refreshToken();
            });

            // User logs out while the refresh is in flight
            act(() => {
                result.current.logout();
            });

            let token: string | null = 'unset';
            await act(async () => {
                resolveRefresh({
                    ok: true,
                    json: () => ({ error: false, data: { access_token: 'late-token' } }),
                });
                token = await refreshPromise;
            });

            expect(token).toBeNull();
            expect(result.current.authToken).toBeNull();
            expect(mockFetch).toHaveBeenCalledTimes(1); // no CSRF fetch for the discarded token
        });
    });
});
