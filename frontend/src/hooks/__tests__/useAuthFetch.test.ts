import { renderHook } from '@test-utils';
import useAuthFetch from 'hooks/useAuthFetch';
import type { AuthContextType } from 'types/AuthContext.type';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const URL = '/api/test';

function mockResponse(status: number, body: unknown = { error: false, data: null, messages: [] }) {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: () => Promise.resolve(body),
    };
}

// Reads the RequestInit passed to the nth fetch call
function fetchInit(call = 0): RequestInit & { headers: Record<string, string> } {
    const args = mockFetch.mock.calls[call] as [string, RequestInit & { headers: Record<string, string> }];
    return args[1];
}

describe('useAuthFetch', () => {
    let getLatestAuthToken: jest.Mock<string | null>;
    let getCsrfToken: jest.Mock<Promise<string | null>, [string, boolean?]>;
    let refreshToken: jest.Mock<Promise<string | null>>;
    let logout: jest.Mock;

    const setup = () => {
        const { result } = renderHook(() => useAuthFetch(), {
            authContextValue: {
                getLatestAuthToken,
                getCsrfToken,
                refreshToken,
                logout,
            } as unknown as AuthContextType,
        });
        return result.current;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockReset();
        getLatestAuthToken = jest.fn<string | null, []>(() => 'token');
        getCsrfToken = jest.fn<Promise<string | null>, [string, boolean?]>(() => Promise.resolve('csrf'));
        refreshToken = jest.fn<Promise<string | null>, []>(() => Promise.resolve('new_token'));
        logout = jest.fn();
    });

    describe('Preconditions', () => {
        it('Should return null without fetching when there is no auth token', async () => {
            getLatestAuthToken.mockReturnValue(null);
            const authFetch = setup();

            await expect(authFetch({ url: URL })).resolves.toBeNull();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('Should still fetch with an empty string token since only null/undefined means missing', async () => {
            getLatestAuthToken.mockReturnValue('');
            mockFetch.mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();

            await authFetch({ url: URL });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(fetchInit().headers['x-auth-token']).toBe('');
        });

        it('Should log out and return null when a non-GET request cannot get a CSRF token', async () => {
            getCsrfToken.mockResolvedValue(null);
            const authFetch = setup();

            await expect(authFetch({ url: URL, method: 'POST' })).resolves.toBeNull();
            expect(logout).toHaveBeenCalledTimes(1);
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });

    describe('Request building', () => {
        it('Should send a GET without CSRF token, body, or signal', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();

            await authFetch({ url: URL });

            expect(getCsrfToken).not.toHaveBeenCalled();
            expect(mockFetch).toHaveBeenCalledWith(URL, {
                method: 'GET',
                signal: null,
                headers: {
                    Accept: 'application/json',
                    'x-auth-token': 'token',
                    'Content-Type': 'application/json',
                },
                body: null,
            });
        });

        it('Should send a JSON body with CSRF token, signal, and additional headers on non-GET requests', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();
            const controller = new AbortController();

            await authFetch({
                url: URL,
                method: 'PUT',
                signal: controller.signal,
                additionalHeaders: { 'x-extra': 'yes' },
                body: { amount: 0 },
            });

            expect(getCsrfToken).toHaveBeenCalledWith('token');
            const init = fetchInit();
            expect(init.method).toBe('PUT');
            expect(init.signal).toBe(controller.signal);
            expect(init.body).toBe(JSON.stringify({ amount: 0 }));
            expect(init.headers).toEqual({
                'x-extra': 'yes',
                Accept: 'application/json',
                'x-auth-token': 'token',
                'Content-Type': 'application/json',
                'x-csrf-token': 'csrf',
            });
        });

        it('Should send FormData as-is and not set Content-Type', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();
            const formData = new FormData();
            formData.append('field', 'value');

            await authFetch({ url: URL, method: 'POST', body: formData });

            const init = fetchInit();
            expect(init.body).toBe(formData);
            expect(init.headers['Content-Type']).toBeUndefined();
            expect(init.headers['x-csrf-token']).toBe('csrf');
        });

        it('Should not let additional headers override the auth token', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();

            await authFetch({ url: URL, additionalHeaders: { 'x-auth-token': 'spoofed' } });

            expect(fetchInit().headers['x-auth-token']).toBe('token');
        });
    });

    describe('401 handling', () => {
        it('Should refresh the token and retry a GET', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(401)).mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();

            const response = await authFetch({ url: URL });

            expect(refreshToken).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(fetchInit(1).headers['x-auth-token']).toBe('new_token');
            expect(response?.status).toBe(200);
            expect(logout).not.toHaveBeenCalled();
        });

        it('Should get a fresh CSRF token for the new auth token before retrying a non-GET', async () => {
            getCsrfToken.mockResolvedValueOnce('csrf').mockResolvedValueOnce('new_csrf');
            mockFetch.mockResolvedValueOnce(mockResponse(401)).mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();

            await authFetch({ url: URL, method: 'DELETE' });

            expect(getCsrfToken).toHaveBeenLastCalledWith('new_token', true);
            expect(fetchInit(1).headers['x-auth-token']).toBe('new_token');
            expect(fetchInit(1).headers['x-csrf-token']).toBe('new_csrf');
        });

        it('Should log out and return the 401 when refresh fails', async () => {
            refreshToken.mockResolvedValue(null);
            mockFetch.mockResolvedValueOnce(mockResponse(401));
            const authFetch = setup();

            const response = await authFetch({ url: URL });

            expect(logout).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response?.status).toBe(401);
        });

        it('Should log out when the CSRF token cannot be refreshed after a token refresh', async () => {
            getCsrfToken.mockResolvedValueOnce('csrf').mockResolvedValueOnce(null);
            mockFetch.mockResolvedValueOnce(mockResponse(401));
            const authFetch = setup();

            const response = await authFetch({ url: URL, method: 'POST' });

            expect(logout).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response?.status).toBe(401);
        });

        it('Should log out when the retry is still 401', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(401)).mockResolvedValueOnce(mockResponse(401));
            const authFetch = setup();

            const response = await authFetch({ url: URL });

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(logout).toHaveBeenCalledTimes(1);
            expect(response?.status).toBe(401);
        });
    });

    describe('403 handling', () => {
        const csrfError = { error: true, messages: ['Invalid CSRF token'] };

        it('Should refresh the CSRF token and retry when the 403 is a CSRF error', async () => {
            getCsrfToken.mockResolvedValueOnce('csrf').mockResolvedValueOnce('new_csrf');
            getLatestAuthToken.mockReturnValueOnce('token').mockReturnValueOnce('latest_token');
            mockFetch.mockResolvedValueOnce(mockResponse(403, csrfError)).mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();

            const response = await authFetch({ url: URL, method: 'POST' });

            expect(getCsrfToken).toHaveBeenLastCalledWith('latest_token', true);
            expect(fetchInit(1).headers['x-auth-token']).toBe('latest_token');
            expect(fetchInit(1).headers['x-csrf-token']).toBe('new_csrf');
            expect(response?.status).toBe(200);
            expect(logout).not.toHaveBeenCalled();
        });

        it('Should match CSRF messages case-insensitively', async () => {
            mockFetch
                .mockResolvedValueOnce(mockResponse(403, { ...csrfError, messages: ['csrf mismatch'] }))
                .mockResolvedValueOnce(mockResponse(200));
            const authFetch = setup();

            await authFetch({ url: URL, method: 'POST' });

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it.each([
            ['a non-CSRF message', { error: true, messages: ['Forbidden'] }],
            ['no messages', { error: false, data: null }],
            ['a malformed body', { unexpected: 'shape' }],
            ['a non-JSON body', undefined],
        ])('Should return the 403 without retrying for %s', async (_label, body) => {
            const response403 =
                body === undefined
                    ? { status: 403, ok: false, json: () => Promise.reject(new Error('not json')) }
                    : mockResponse(403, body);
            mockFetch.mockResolvedValueOnce(response403);
            const authFetch = setup();

            const response = await authFetch({ url: URL, method: 'POST' });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response?.status).toBe(403);
            expect(logout).not.toHaveBeenCalled();
        });

        it('Should not treat a 403 on a GET as a CSRF error', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(403, csrfError));
            const authFetch = setup();

            const response = await authFetch({ url: URL });

            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(response?.status).toBe(403);
        });

        it('Should log out when the auth token disappears before the CSRF retry', async () => {
            getLatestAuthToken.mockReturnValueOnce('token').mockReturnValueOnce(null);
            mockFetch.mockResolvedValueOnce(mockResponse(403, csrfError));
            const authFetch = setup();

            await authFetch({ url: URL, method: 'POST' });

            expect(logout).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('Should log out when a new CSRF token cannot be fetched', async () => {
            getCsrfToken.mockResolvedValueOnce('csrf').mockResolvedValueOnce(null);
            mockFetch.mockResolvedValueOnce(mockResponse(403, csrfError));
            const authFetch = setup();

            await authFetch({ url: URL, method: 'POST' });

            expect(logout).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('Should log out when the retry is still 403', async () => {
            mockFetch
                .mockResolvedValueOnce(mockResponse(403, csrfError))
                .mockResolvedValueOnce(mockResponse(403, csrfError));
            const authFetch = setup();

            const response = await authFetch({ url: URL, method: 'POST' });

            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(logout).toHaveBeenCalledTimes(1);
            expect(response?.status).toBe(403);
        });
    });

    describe('Other statuses', () => {
        it('Should log out on a 502', async () => {
            mockFetch.mockResolvedValueOnce(mockResponse(502));
            const authFetch = setup();

            const response = await authFetch({ url: URL });

            expect(logout).toHaveBeenCalledTimes(1);
            expect(response?.status).toBe(502);
        });

        it.each([200, 400, 404, 500])('Should return a %i response as-is without logging out', async (status) => {
            mockFetch.mockResolvedValueOnce(mockResponse(status));
            const authFetch = setup();

            const response = await authFetch({ url: URL });

            expect(response?.status).toBe(status);
            expect(logout).not.toHaveBeenCalled();
            expect(refreshToken).not.toHaveBeenCalled();
        });
    });
});
