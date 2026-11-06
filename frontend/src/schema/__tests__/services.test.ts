import type useAuthFetch from 'hooks/useAuthFetch';
import type { usePending2FAFetch } from 'hooks/usePendingFetch';
import { incomeService } from 'schema/income';
import { subscriptionService } from 'schema/subscription';
import { userService } from 'schema/user';
import type { Subscription } from 'types/Subscription.type';
import { API_BASE_URL } from 'utils/constants';

type AuthFetch = ReturnType<typeof useAuthFetch>;
type Pending2FAFetch = ReturnType<typeof usePending2FAFetch>;

global.fetch = jest.fn();
const mockFetch = global.fetch as jest.Mock;

function mockResponse(status: number, body?: unknown) {
    return {
        status,
        ok: status >= 200 && status < 300,
        json: () => (body === undefined ? Promise.reject(new Error('no body')) : Promise.resolve(body)),
    } as unknown as Response;
}

const ok = (data: unknown = null) => mockResponse(200, { error: false, data });
const apiError = (status: number, messages: string[] = ['Server said no']) =>
    mockResponse(status, { error: true, messages });

// Matches an APIError carrying the message and status code
const apiErrorWith = (message: string, statusCode: number, data?: string) =>
    expect.objectContaining({
        name: 'APIError',
        message,
        statusCode,
        ...(data === undefined ? {} : { data }),
    }) as unknown;

beforeEach(() => {
    mockFetch.mockReset();
});

describe('incomeService', () => {
    const authFetch = jest.fn<ReturnType<AuthFetch>, Parameters<AuthFetch>>();
    const service = incomeService(authFetch);

    beforeEach(() => {
        authFetch.mockReset();
    });

    describe('fetchIncome', () => {
        it('Should call the income endpoint with the query string and return the data', async () => {
            authFetch.mockResolvedValue(ok({ pay: 1000, extra: 0 }));
            const controller = new AbortController();

            await expect(service.fetchIncome('startDate=a&endDate=b', controller.signal)).resolves.toEqual({
                pay: 1000,
                extra: 0,
            });
            expect(authFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/income?startDate=a&endDate=b`,
                method: 'GET',
                signal: controller.signal,
            });
        });

        it('Should throw when not authenticated', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.fetchIncome('')).rejects.toThrow('User not authenticated');
        });

        it('Should throw on a non-ok response', async () => {
            authFetch.mockResolvedValue(mockResponse(500, {}));
            await expect(service.fetchIncome('')).rejects.toThrow('Error Retrieving Income. Please try again.');
        });

        it.each([
            ['negative pay', { error: false, data: { pay: -1, extra: 0 } }],
            ['missing extra', { error: false, data: { pay: 1 } }],
            ['a non-JSON body', undefined],
        ])('Should throw a validation error for %s', async (_label, body) => {
            authFetch.mockResolvedValue(mockResponse(200, body));
            await expect(service.fetchIncome('')).rejects.toThrow('Income Validation failed: Invalid response format');
        });

        it('Should throw when the API reports an error', async () => {
            authFetch.mockResolvedValue(apiError(200));
            await expect(service.fetchIncome('')).rejects.toThrow('Error Retrieving Income. Please try again.');
        });
    });

    describe('updateIncome', () => {
        const body = { date: '2026-03', pay: '1000' };

        it('Should PUT the body and resolve on success', async () => {
            authFetch.mockResolvedValue(ok());

            await expect(service.updateIncome(body)).resolves.toBeUndefined();
            expect(authFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/income`, method: 'PUT', body });
        });

        it('Should throw when not authenticated', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.updateIncome(body)).rejects.toThrow('User not authenticated');
        });

        it.each([
            ['an API error body', { error: true, messages: ['Invalid pay'] }],
            ['a malformed body', { unexpected: true }],
            ['a non-JSON body', undefined],
            ['a body that claims success', { error: false }],
        ])('Should throw on a non-ok response with %s', async (_label, responseBody) => {
            authFetch.mockResolvedValue(mockResponse(500, responseBody));
            await expect(service.updateIncome(body)).rejects.toThrow('Error updating income. Please try again.');
        });

        it('Should throw on an ok response whose body reports an error', async () => {
            authFetch.mockResolvedValue(apiError(200, ['Invalid pay']));
            await expect(service.updateIncome(body)).rejects.toThrow('Error updating income. Please try again.');
        });

        it('Should resolve on an ok response with an empty body', async () => {
            authFetch.mockResolvedValue(mockResponse(204));
            await expect(service.updateIncome(body)).resolves.toBeUndefined();
        });
    });

    describe('fetchExtraIncome', () => {
        const entry = { id: 3, date: '2026-03-15', amount: 250.5, description: 'Freelance project' };

        it('Should call the extra income endpoint with the query string and return the entries', async () => {
            authFetch.mockResolvedValue(ok([entry]));
            const controller = new AbortController();

            await expect(service.fetchExtraIncome('startDate=a&endDate=b', controller.signal)).resolves.toEqual([
                entry,
            ]);
            expect(authFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/income/extra?startDate=a&endDate=b`,
                method: 'GET',
                signal: controller.signal,
            });
        });

        it('Should resolve an empty list', async () => {
            authFetch.mockResolvedValue(ok([]));
            await expect(service.fetchExtraIncome('')).resolves.toEqual([]);
        });

        it('Should throw when not authenticated', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.fetchExtraIncome('')).rejects.toThrow('User not authenticated');
        });

        it('Should throw on a non-ok response', async () => {
            authFetch.mockResolvedValue(mockResponse(500, {}));
            await expect(service.fetchExtraIncome('')).rejects.toThrow(
                'Error Retrieving Extra Income. Please try again.'
            );
        });

        it.each([
            ['a non-array payload', { error: false, data: entry }],
            ['a zero amount', { error: false, data: [{ ...entry, amount: 0 }] }],
            ['a missing description', { error: false, data: [{ id: 3, date: '2026-03-15', amount: 1 }] }],
            ['a non-ISO date', { error: false, data: [{ ...entry, date: '03-15-2026' }] }],
            ['a non-JSON body', undefined],
        ])('Should throw a validation error for %s', async (_label, body) => {
            authFetch.mockResolvedValue(mockResponse(200, body));
            await expect(service.fetchExtraIncome('')).rejects.toThrow(
                'Extra Income Validation failed: Invalid response format'
            );
        });

        it('Should throw when the API reports an error', async () => {
            authFetch.mockResolvedValue(apiError(200));
            await expect(service.fetchExtraIncome('')).rejects.toThrow(
                'Error Retrieving Extra Income. Please try again.'
            );
        });
    });

    describe('saveExtraIncome', () => {
        const body = { date: '2026-03-15', amount: '250', description: 'Freelance project' };

        it('Should POST the body and resolve the new id', async () => {
            authFetch.mockResolvedValue(ok({ id: 12 }));

            await expect(service.saveExtraIncome(body)).resolves.toBe(12);
            expect(authFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/income/extra`, method: 'POST', body });
        });

        it('Should throw when not authenticated', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.saveExtraIncome(body)).rejects.toThrow('User not authenticated');
        });

        it('Should throw on a non-ok response', async () => {
            authFetch.mockResolvedValue(apiError(400, ['Invalid amount']));
            await expect(service.saveExtraIncome(body)).rejects.toThrow('Error saving extra income. Please try again.');
        });

        it.each([
            ['a missing id', { error: false, data: {} }],
            ['no data', { error: false }],
            ['a non-JSON body', undefined],
        ])('Should throw a validation error for %s', async (_label, responseBody) => {
            authFetch.mockResolvedValue(mockResponse(200, responseBody));
            await expect(service.saveExtraIncome(body)).rejects.toThrow(
                'Extra Income Validation failed: Invalid response format'
            );
        });

        it('Should throw when the API reports an error', async () => {
            authFetch.mockResolvedValue(apiError(200));
            await expect(service.saveExtraIncome(body)).rejects.toThrow('Error saving extra income. Please try again.');
        });
    });

    describe('deleteExtraIncome', () => {
        it('Should DELETE the entry by id and resolve on success', async () => {
            authFetch.mockResolvedValue(ok());
            const controller = new AbortController();

            await expect(service.deleteExtraIncome(12, controller.signal)).resolves.toBeUndefined();
            expect(authFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/income/extra/12`,
                method: 'DELETE',
                signal: controller.signal,
            });
        });

        it('Should throw when not authenticated', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.deleteExtraIncome(12)).rejects.toThrow('User not authenticated');
        });

        it.each([
            ['a not found response', apiError(404, ['Not found.'])],
            ['a server error', mockResponse(500, undefined)],
        ])('Should throw on %s', async (_label, response) => {
            authFetch.mockResolvedValue(response);
            await expect(service.deleteExtraIncome(12)).rejects.toThrow(
                'Error deleting extra income. Please try again.'
            );
        });

        it('Should throw on an ok response whose body reports an error', async () => {
            authFetch.mockResolvedValue(apiError(200));
            await expect(service.deleteExtraIncome(12)).rejects.toThrow(
                'Error deleting extra income. Please try again.'
            );
        });

        it('Should resolve on an ok response with an empty body', async () => {
            authFetch.mockResolvedValue(mockResponse(204));
            await expect(service.deleteExtraIncome(12)).resolves.toBeUndefined();
        });
    });
});

describe('subscriptionService', () => {
    const authFetch = jest.fn<ReturnType<AuthFetch>, Parameters<AuthFetch>>();
    const service = subscriptionService(authFetch);
    const row: Subscription = {
        id: 7,
        nextChargeDate: '2026-04-01',
        amount: 9.99,
        description: 'Streaming',
        category: 'Entertainment',
        interval: 'M',
        active: 1,
    };

    beforeEach(() => {
        authFetch.mockReset();
    });

    describe('toggleSubscription', () => {
        it('Should PATCH the inverted active flag', async () => {
            authFetch.mockResolvedValue(ok({ nextDate: '2026-04-01T00:00:00' }));

            await service.toggleSubscription(row);

            expect(authFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/subscriptions/7/active/false`,
                method: 'PATCH',
                signal: undefined,
            });
        });

        it('Should send active true when toggling an inactive subscription', async () => {
            authFetch.mockResolvedValue(ok({ nextDate: '2026-04-01T00:00:00' }));

            await service.toggleSubscription({ ...row, active: 0 });

            expect(authFetch).toHaveBeenCalledWith(
                expect.objectContaining({ url: `${API_BASE_URL}/subscriptions/7/active/true` })
            );
        });

        it('Should throw when not authenticated', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.toggleSubscription(row)).rejects.toThrow('User not authenticated');
        });

        it('Should throw on a non-ok response', async () => {
            authFetch.mockResolvedValue(mockResponse(500, {}));
            await expect(service.toggleSubscription(row)).rejects.toThrow('Invalid network response');
        });

        it.each([
            ['an invalid nextDate', { error: false, data: { nextDate: 'tomorrow' } }],
            ['no data', { error: false }],
            ['a non-JSON body', undefined],
        ])('Should throw a validation error for %s', async (_label, body) => {
            authFetch.mockResolvedValue(mockResponse(200, body));
            await expect(service.toggleSubscription(row)).rejects.toThrow(
                'Toggle Validation failed: Invalid response format'
            );
        });

        it('Should throw when the API reports an error', async () => {
            authFetch.mockResolvedValue(apiError(200));
            await expect(service.toggleSubscription(row)).rejects.toThrow('Error toggling subscription');
        });
    });

    describe('deleteSubscription', () => {
        it('Should DELETE the subscription by id', async () => {
            authFetch.mockResolvedValue(ok());

            await expect(service.deleteSubscription(7)).resolves.toBeUndefined();
            expect(authFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/subscriptions/7`,
                method: 'DELETE',
                signal: undefined,
            });
        });

        it('Should throw when not authenticated', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.deleteSubscription(7)).rejects.toThrow('User not authenticated');
        });

        it('Should throw on a non-ok response', async () => {
            authFetch.mockResolvedValue(mockResponse(404, {}));
            await expect(service.deleteSubscription(7)).rejects.toThrow('Invalid network response');
        });

        it('Should throw a validation error for an unexpected payload', async () => {
            authFetch.mockResolvedValue(ok({ id: 7 }));
            await expect(service.deleteSubscription(7)).rejects.toThrow(
                'Delete Validation failed: Invalid response format'
            );
        });

        it('Should throw when the API reports an error', async () => {
            authFetch.mockResolvedValue(apiError(200));
            await expect(service.deleteSubscription(7)).rejects.toThrow('Error toggling subscription');
        });
    });
});

describe('userService', () => {
    const authFetch = jest.fn<ReturnType<AuthFetch>, Parameters<AuthFetch>>();
    const pending2FAFetch = jest.fn<ReturnType<Pending2FAFetch>, Parameters<Pending2FAFetch>>();
    const service = userService({ authFetch, pending2FAFetch });
    const noFetchService = userService({});

    beforeEach(() => {
        authFetch.mockReset();
        pending2FAFetch.mockReset();
    });

    describe('login', () => {
        const formData = new FormData();

        it('Should return the access token and mfa flag', async () => {
            mockFetch.mockResolvedValue(ok({ access_token: 'jwt', mfa_required: true }));

            await expect(service.login(formData)).resolves.toEqual({ access_token: 'jwt', mfa_required: true });
            expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/login`, { method: 'POST', body: formData });
        });

        it('Should leave mfa_required undefined when the API omits it', async () => {
            mockFetch.mockResolvedValue(ok({ access_token: 'jwt' }));
            await expect(service.login(formData)).resolves.toEqual({ access_token: 'jwt', mfa_required: undefined });
        });

        it('Should throw a rate limit error on 429', async () => {
            mockFetch.mockResolvedValue(mockResponse(429));
            await expect(service.login(formData)).rejects.toEqual(apiErrorWith('Too many requests. Please wait.', 429));
        });

        it('Should throw a validation error for a malformed body', async () => {
            mockFetch.mockResolvedValue(mockResponse(500));
            await expect(service.login(formData)).rejects.toEqual(
                apiErrorWith('Login Validation failed: Invalid response format', 500)
            );
        });

        it('Should throw a 403 without any token when the email is unverified', async () => {
            mockFetch.mockResolvedValue(mockResponse(403, { error: true, messages: ['Please verify your email.'] }));
            await expect(service.login(formData)).rejects.toEqual(apiErrorWith('Please verify your email.', 403, ''));
        });

        it('Should throw a 403 even when the unverified response has no body', async () => {
            mockFetch.mockResolvedValue(mockResponse(403));
            await expect(service.login(formData)).rejects.toEqual(apiErrorWith('Please verify your email.', 403));
        });

        it('Should throw Invalid Login when the API reports an error', async () => {
            mockFetch.mockResolvedValue(apiError(401));
            await expect(service.login(formData)).rejects.toEqual(apiErrorWith('Invalid Login.', 401));
        });

        it('Should throw Invalid Login for a non-ok success body', async () => {
            mockFetch.mockResolvedValue(mockResponse(500, { error: false, data: { access_token: 'jwt' } }));
            await expect(service.login(formData)).rejects.toEqual(apiErrorWith('Invalid Login.', 500));
        });
    });

    describe('logout', () => {
        it('Should do nothing without an authFetch', async () => {
            await expect(noFetchService.logout()).resolves.toBeUndefined();
        });

        it('Should POST to the logout endpoint', async () => {
            authFetch.mockResolvedValue(ok());

            await service.logout();

            expect(authFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/security/logout`, method: 'POST' });
        });

        it.each([
            ['null', null],
            ['a non-ok response', mockResponse(500, {})],
        ])('Should throw when the response is %s', async (_label, response) => {
            authFetch.mockResolvedValue(response);
            await expect(service.logout()).rejects.toThrow('Invalid network response');
        });
    });

    describe('register', () => {
        const body = { email: 'a@b.co', password: 'pw', salary: '1', monthlyTakeHome: '1' };

        it('Should POST JSON and resolve without a token', async () => {
            mockFetch.mockResolvedValue(
                mockResponse(200, { error: false, data: {}, messages: ['Check your email for a verification code.'] })
            );

            await expect(service.register(body)).resolves.toBeUndefined();
            expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/register`, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('Should throw a rate limit error on 429', async () => {
            mockFetch.mockResolvedValue(mockResponse(429));
            await expect(service.register(body)).rejects.toEqual(apiErrorWith('Too many requests. Please wait.', 429));
        });

        it('Should throw for a malformed body', async () => {
            mockFetch.mockResolvedValue(mockResponse(200, { error: false, data: 'x' }));
            await expect(service.register(body)).rejects.toEqual(
                apiErrorWith('Invalid Response Format. Please try again.', 200)
            );
        });

        it('Should throw the first API message', async () => {
            mockFetch.mockResolvedValue(apiError(400, ['Invalid email', 'second']));
            await expect(service.register(body)).rejects.toEqual(apiErrorWith('Invalid email', 400));
        });

        it('Should fall back to a default message when the API sends no messages', async () => {
            mockFetch.mockResolvedValue(apiError(400, []));
            await expect(service.register(body)).rejects.toEqual(apiErrorWith('Please try again.', 400));
        });

        it('Should throw for a non-ok success body', async () => {
            mockFetch.mockResolvedValue(mockResponse(500, { error: false, data: {} }));
            await expect(service.register(body)).rejects.toEqual(apiErrorWith('Please try again.', 500));
        });
    });

    describe('updateProfile', () => {
        const body = { password: '', currentPassword: '', salary: '1', monthlyTakeHome: '1' };

        it('Should throw without an authFetch', async () => {
            await expect(noFetchService.updateProfile(body)).rejects.toThrow('Invalid state');
        });

        it('Should PATCH the profile', async () => {
            authFetch.mockResolvedValue(ok());

            await expect(service.updateProfile(body)).resolves.toBeUndefined();
            expect(authFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/me`, method: 'PATCH', body });
        });

        it('Should send the current password with a password change', async () => {
            const passwordBody = { ...body, password: 'newpassword1', currentPassword: 'oldpassword1' };
            authFetch.mockResolvedValue(ok());

            await expect(service.updateProfile(passwordBody)).resolves.toBeUndefined();
            expect(authFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/me`, method: 'PATCH', body: passwordBody });
        });

        it('Should throw the API message when the current password is incorrect', async () => {
            authFetch.mockResolvedValue(apiError(400, ['Current password is incorrect.']));
            await expect(service.updateProfile(body)).rejects.toEqual(
                apiErrorWith('Current password is incorrect.', 400)
            );
        });

        it.each([
            ['null', null],
            ['a non-ok response', mockResponse(400, {})],
        ])('Should throw when the response is %s', async (_label, response) => {
            authFetch.mockResolvedValue(response);
            await expect(service.updateProfile(body)).rejects.toThrow('Invalid network response');
        });
    });

    describe('resendVerificationCode', () => {
        const body = { email: 'a@b.co', password: 'pw' };

        it('Should POST the credentials as JSON without an auth token and resolve on success', async () => {
            mockFetch.mockResolvedValue(ok());

            await expect(noFetchService.resendVerificationCode(body)).resolves.toBeUndefined();
            expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/resendVerificationCode`, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('Should throw for a malformed body', async () => {
            mockFetch.mockResolvedValue(mockResponse(200));
            await expect(service.resendVerificationCode(body)).rejects.toThrow('Please try again.');
        });

        it('Should throw the API message on 429', async () => {
            mockFetch.mockResolvedValue(apiError(429, ['Please wait before requesting another verification email.']));
            await expect(service.resendVerificationCode(body)).rejects.toEqual(
                apiErrorWith('Please wait before requesting another verification email.', 429)
            );
        });

        it('Should fall back to a default message on 429 without messages', async () => {
            mockFetch.mockResolvedValue(mockResponse(429, { error: false }));
            await expect(service.resendVerificationCode(body)).rejects.toEqual(
                apiErrorWith('Too many requests. Please wait.', 429)
            );
        });

        it('Should throw on other non-ok responses', async () => {
            mockFetch.mockResolvedValue(apiError(500));
            await expect(service.resendVerificationCode(body)).rejects.toThrow('Invalid network response');
        });
    });

    describe('verify2fa', () => {
        const formData = new FormData();

        it('Should throw without a pending2FAFetch', async () => {
            await expect(noFetchService.verify2fa(formData)).rejects.toThrow('Invalid state');
        });

        it('Should return the access token', async () => {
            pending2FAFetch.mockResolvedValue(ok({ access_token: 'jwt' }));

            await expect(service.verify2fa(formData)).resolves.toBe('jwt');
            expect(pending2FAFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/verify2fa`,
                method: 'POST',
                body: formData,
            });
        });

        it('Should throw a 401 when there is no response', async () => {
            pending2FAFetch.mockResolvedValue(null);
            await expect(service.verify2fa(formData)).rejects.toEqual(apiErrorWith('Invalid state', 401));
        });

        it('Should throw a rate limit error on 429', async () => {
            pending2FAFetch.mockResolvedValue(mockResponse(429));
            await expect(service.verify2fa(formData)).rejects.toEqual(
                apiErrorWith('Too many requests. Please wait.', 429)
            );
        });

        it('Should throw for a malformed body', async () => {
            pending2FAFetch.mockResolvedValue(mockResponse(200, {}));
            await expect(service.verify2fa(formData)).rejects.toEqual(apiErrorWith('Invalid response format.', 200));
        });

        it('Should throw the first API message', async () => {
            pending2FAFetch.mockResolvedValue(apiError(400, ['Code expired']));
            await expect(service.verify2fa(formData)).rejects.toEqual(apiErrorWith('Code expired', 400));
        });

        it('Should fall back to a default message when the API sends no messages', async () => {
            pending2FAFetch.mockResolvedValue(apiError(400, []));
            await expect(service.verify2fa(formData)).rejects.toEqual(apiErrorWith('Invalid or expired code.', 400));
        });

        it('Should throw for a non-ok success body', async () => {
            pending2FAFetch.mockResolvedValue(mockResponse(500, { error: false, data: { access_token: 'jwt' } }));
            await expect(service.verify2fa(formData)).rejects.toEqual(apiErrorWith('Invalid or expired code.', 500));
        });
    });

    describe('verify', () => {
        const body = { email: 'a@b.co', password: 'pw', verificationCode: 'ABCD1234' };

        it('Should POST the credentials and code as JSON without an auth token and return the access token', async () => {
            mockFetch.mockResolvedValue(ok({ access_token: 'jwt' }));

            await expect(noFetchService.verify(body)).resolves.toBe('jwt');
            expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/verify`, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' },
            });
        });

        it('Should throw a rate limit error on 429', async () => {
            mockFetch.mockResolvedValue(mockResponse(429));
            await expect(service.verify(body)).rejects.toEqual(apiErrorWith('Too many requests. Please wait.', 429));
        });

        it('Should throw for a malformed body', async () => {
            mockFetch.mockResolvedValue(mockResponse(200, { error: false, data: {} }));
            await expect(service.verify(body)).rejects.toEqual(
                apiErrorWith('Verify Validation failed: Invalid response format', 200)
            );
        });

        it('Should throw the first API message as a 400', async () => {
            mockFetch.mockResolvedValue(apiError(400, ['Invalid or expired verification code.']));
            await expect(service.verify(body)).rejects.toEqual(
                apiErrorWith('Invalid or expired verification code.', 400)
            );
        });

        it('Should surface the already verified message', async () => {
            mockFetch.mockResolvedValue(apiError(400, ['Account already verified. Please log in.']));
            await expect(service.verify(body)).rejects.toEqual(
                apiErrorWith('Account already verified. Please log in.', 400)
            );
        });

        it('Should fall back to a default message when the API sends no messages', async () => {
            mockFetch.mockResolvedValue(apiError(400, []));
            await expect(service.verify(body)).rejects.toEqual(
                apiErrorWith('Invalid or expired verification code.', 400)
            );
        });
    });

    describe('setup2fa', () => {
        it('Should throw without an authFetch', async () => {
            await expect(noFetchService.setup2fa()).rejects.toThrow('Invalid state');
        });

        it('Should return the QR code and secret', async () => {
            authFetch.mockResolvedValue(ok({ qrCode: '<img>', secret: 'ABC' }));

            await expect(service.setup2fa()).resolves.toEqual({ qrCode: '<img>', secret: 'ABC' });
            expect(authFetch).toHaveBeenCalledWith({ url: `${API_BASE_URL}/me/2fa/setup`, method: 'POST' });
        });

        it('Should throw a 401 when there is no response', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.setup2fa()).rejects.toEqual(apiErrorWith('Invalid state', 401));
        });

        it('Should throw for a malformed body', async () => {
            authFetch.mockResolvedValue(ok({ qrCode: '<img>' }));
            await expect(service.setup2fa()).rejects.toEqual(
                apiErrorWith('Validation failed: Invalid response format', 200)
            );
        });

        it('Should throw the first API message', async () => {
            authFetch.mockResolvedValue(apiError(409, ['2FA already enabled']));
            await expect(service.setup2fa()).rejects.toEqual(apiErrorWith('2FA already enabled', 409));
        });

        it('Should fall back to a default message when the API sends no messages', async () => {
            authFetch.mockResolvedValue(apiError(500, []));
            await expect(service.setup2fa()).rejects.toEqual(apiErrorWith('Failed to initiate 2FA setup.', 500));
        });
    });

    describe('confirm2fa', () => {
        it('Should throw without an authFetch', async () => {
            await expect(noFetchService.confirm2fa('123456')).rejects.toThrow('Invalid state');
        });

        it('Should POST the code and return recovery codes', async () => {
            authFetch.mockResolvedValue(ok({ recoveryCodes: ['a', 'b'] }));

            await expect(service.confirm2fa('123456')).resolves.toEqual({ recoveryCodes: ['a', 'b'] });
            expect(authFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/me/2fa/confirm`,
                method: 'POST',
                body: { code: '123456' },
            });
        });

        it('Should throw a 401 when there is no response', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.confirm2fa('123456')).rejects.toEqual(apiErrorWith('Invalid state', 401));
        });

        it('Should throw a rate limit error on 429', async () => {
            authFetch.mockResolvedValue(mockResponse(429));
            await expect(service.confirm2fa('123456')).rejects.toEqual(
                apiErrorWith('Too many requests. Please wait.', 429)
            );
        });

        it('Should throw for a malformed body', async () => {
            authFetch.mockResolvedValue(ok({ recoveryCodes: 'a,b' }));
            await expect(service.confirm2fa('123456')).rejects.toEqual(
                apiErrorWith('Validation failed: Invalid response format', 200)
            );
        });

        it('Should throw the first API message', async () => {
            authFetch.mockResolvedValue(apiError(400, ['Bad code']));
            await expect(service.confirm2fa('123456')).rejects.toEqual(apiErrorWith('Bad code', 400));
        });

        it('Should fall back to a default message when the API sends no messages', async () => {
            authFetch.mockResolvedValue(apiError(400, []));
            await expect(service.confirm2fa('123456')).rejects.toEqual(apiErrorWith('Invalid or expired code.', 400));
        });
    });

    describe('disable2fa', () => {
        it('Should throw without an authFetch', async () => {
            await expect(noFetchService.disable2fa('123456')).rejects.toThrow('Invalid state');
        });

        it('Should POST the code and resolve on success', async () => {
            authFetch.mockResolvedValue(mockResponse(200, { error: false }));

            await expect(service.disable2fa('123456')).resolves.toBeUndefined();
            expect(authFetch).toHaveBeenCalledWith({
                url: `${API_BASE_URL}/me/2fa/disable`,
                method: 'POST',
                body: { code: '123456' },
            });
        });

        it('Should throw a 401 when there is no response', async () => {
            authFetch.mockResolvedValue(null);
            await expect(service.disable2fa('123456')).rejects.toEqual(apiErrorWith('Invalid state', 401));
        });

        it('Should throw a rate limit error on 429', async () => {
            authFetch.mockResolvedValue(mockResponse(429));
            await expect(service.disable2fa('123456')).rejects.toEqual(
                apiErrorWith('Too many requests. Please wait.', 429)
            );
        });

        it('Should throw for a malformed body', async () => {
            authFetch.mockResolvedValue(mockResponse(200));
            await expect(service.disable2fa('123456')).rejects.toEqual(
                apiErrorWith('Validation failed: Invalid response format', 200)
            );
        });

        it('Should throw the first API message', async () => {
            authFetch.mockResolvedValue(apiError(400, ['Bad code']));
            await expect(service.disable2fa('123456')).rejects.toEqual(apiErrorWith('Bad code', 400));
        });

        it('Should fall back to a default message when the API sends no messages', async () => {
            authFetch.mockResolvedValue(apiError(400, []));
            await expect(service.disable2fa('123456')).rejects.toEqual(apiErrorWith('Invalid or expired code.', 400));
        });
    });
});
