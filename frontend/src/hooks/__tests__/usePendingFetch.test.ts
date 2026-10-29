import { renderHook } from '@test-utils';
import usePendingFetch, { usePending2FAFetch } from 'hooks/usePendingFetch';
import type { AuthContextType } from 'types/AuthContext.type';

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

const URL = '/api/pending';

function mockResponse(status: number) {
    return { status, ok: status >= 200 && status < 300, json: () => Promise.resolve({}) };
}

function fetchInit(call = 0): RequestInit & { headers: Record<string, string> } {
    const args = mockFetch.mock.calls[call] as [string, RequestInit & { headers: Record<string, string> }];
    return args[1];
}

/**
 * Both hooks share the same fetch logic, they only differ in which token they read and clear
 */
describe.each([
    {
        name: 'usePendingFetch',
        hook: usePendingFetch,
        tokenKey: 'pendingToken',
        clearKey: 'setPendingToken',
    },
    {
        name: 'usePending2FAFetch',
        hook: usePending2FAFetch,
        tokenKey: 'pending2FAToken',
        clearKey: 'setPending2FAToken',
    },
] as const)('$name', ({ hook, tokenKey, clearKey }) => {
    let getCsrfToken: jest.Mock<Promise<string | null>, [string]>;
    let setToken: jest.Mock;

    const setup = (token: string | null = 'pending') => {
        const { result } = renderHook(() => hook(), {
            authContextValue: {
                [tokenKey]: token,
                [clearKey]: setToken,
                getCsrfToken,
            } as unknown as AuthContextType,
        });
        return result.current;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockReset();
        getCsrfToken = jest.fn<Promise<string | null>, [string]>(() => Promise.resolve('csrf'));
        setToken = jest.fn();
    });

    it('Should return null without fetching when there is no token', async () => {
        const pendingFetch = setup(null);

        await expect(pendingFetch({ url: URL })).resolves.toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('Should send a GET with the token and no CSRF token or body', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse(200));
        const pendingFetch = setup();

        await pendingFetch({ url: URL });

        expect(getCsrfToken).not.toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledWith(URL, {
            method: 'GET',
            signal: null,
            headers: {
                Accept: 'application/json',
                'x-auth-token': 'pending',
                'Content-Type': 'application/json',
            },
            body: null,
        });
    });

    it('Should send a JSON body and CSRF token on non-GET requests', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse(200));
        const pendingFetch = setup();

        await pendingFetch({ url: URL, method: 'POST', body: { code: '123456' } });

        expect(getCsrfToken).toHaveBeenCalledWith('pending');
        const init = fetchInit();
        expect(init.body).toBe(JSON.stringify({ code: '123456' }));
        expect(init.headers['x-csrf-token']).toBe('csrf');
    });

    it('Should send an empty CSRF header when no CSRF token is available', async () => {
        getCsrfToken.mockResolvedValue(null);
        mockFetch.mockResolvedValueOnce(mockResponse(200));
        const pendingFetch = setup();

        await pendingFetch({ url: URL, method: 'POST' });

        expect(fetchInit().headers['x-csrf-token']).toBe('');
    });

    it('Should send FormData as-is without Content-Type', async () => {
        mockFetch.mockResolvedValueOnce(mockResponse(200));
        const pendingFetch = setup();
        const formData = new FormData();

        await pendingFetch({ url: URL, method: 'POST', body: formData });

        expect(fetchInit().body).toBe(formData);
        expect(fetchInit().headers['Content-Type']).toBeUndefined();
    });

    it.each([
        ['401 on GET', 401, 'GET'],
        ['403 on POST', 403, 'POST'],
        ['502 on GET', 502, 'GET'],
    ] as const)('Should clear the token on %s', async (_label, status, method) => {
        mockFetch.mockResolvedValueOnce(mockResponse(status));
        const pendingFetch = setup();

        const response = await pendingFetch({ url: URL, method });

        expect(setToken).toHaveBeenCalledWith(null);
        expect(response?.status).toBe(status);
    });

    it.each([
        ['200', 200, 'POST'],
        ['403 on GET', 403, 'GET'],
        ['400', 400, 'POST'],
        ['500', 500, 'GET'],
    ] as const)('Should keep the token on %s', async (_label, status, method) => {
        mockFetch.mockResolvedValueOnce(mockResponse(status));
        const pendingFetch = setup();

        await pendingFetch({ url: URL, method });

        expect(setToken).not.toHaveBeenCalled();
    });
});
