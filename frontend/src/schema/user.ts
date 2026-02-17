import useAuthFetch from 'hooks/useAuthFetch';
import usePendingFetch from 'hooks/usePendingFetch';
import { APIError } from 'utils/apiError';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

/**
 * API return formats for:
 * /login (JWT)
 * /register (Pending JWT)
 * /verify (Actual JWT on success)
 */
const AuthAPIResponseSchema = validateAPIResponse(
    z.object({
        access_token: z.string().min(2),
    })
);

interface UserServiceParams {
    authFetch?: ReturnType<typeof useAuthFetch>;
    pendingFetch?: ReturnType<typeof usePendingFetch>;
}

/**
 * Service layer for the user API endpoints
 */
export function userService({ authFetch, pendingFetch }: UserServiceParams) {
    return {
        /**
         * POST /login
         * Login a user and receive their JWT
         *
         * @param formData {email, password}
         * @returns access_token
         */
        async login(formData: FormData): Promise<string> {
            const response = await fetch('/spendingtracker/api/v1/login', {
                method: 'POST',
                body: formData,
            });

            if (response.status === 429) {
                throw new APIError('Too many requests. Please wait.', 429);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = AuthAPIResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new APIError('Login Validation failed: Invalid response format', response.status);
            }

            const result = parsed.data;

            // If 403, throw error with pending token as data
            if (response.status === 403 && !result.error) {
                throw new APIError('Please verify your email.', 403, result.data.access_token);
            }

            if (result.error || !response.ok) {
                throw new APIError('Invalid Login.', response.status);
            }

            // Return access token
            return result.data.access_token;
        },

        /**
         * POST /logout
         *
         * Invalidates JWT
         */
        async logout() {
            if (!authFetch) return;
            const response = await authFetch({
                url: '/spendingtracker/api/v1/security/logout',
                method: 'POST',
            });

            if (!response?.ok) {
                throw new Error('Invalid network response');
            }
            return;
        },

        /**
         * POST /register
         * Registers a new user
         *
         * @rc.email           unique email
         * @rc.password        user password
         * @rc.salary          salary
         * @rc.monthlyTakehome monthly take home
         */
        async register(body: {
            email: string;
            password: string;
            salary: string;
            monthlyTakeHome: string;
        }): Promise<string> {
            const response = await fetch('/spendingtracker/api/v1/register', {
                method: 'POST',
                body: JSON.stringify(body),
            });

            if (response.status == 429) {
                throw new APIError('Too many requests. Please wait.', response.status);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = AuthAPIResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new APIError('Invalid Response Format. Please try again.', response.status);
            }

            const result = parsed.data;

            if (result.error) {
                throw new APIError(result.messages?.[0] ?? 'Please try again.', response.status);
            }

            // Return pending JWT
            return result.data.access_token;
        },

        /**
         * PATCH /spendingtracker/api/v1/me
         * Save a user's profile settings
         *
         * @rc.password (optional) new password
         * @rc.salary   (optional) salary
         * @rc.monthlyTakehome (optional) monthly take home
         */
        async updateProfile(body: { password: string; salary: string; monthlyTakeHome: string }) {
            if (!authFetch) {
                throw new Error('Invalid state');
            }

            const response = await authFetch({
                url: '/spendingtracker/api/v1/me',
                method: 'PATCH',
                body: body,
            });

            if (!response) return;
            if (!response.ok) {
                throw new Error('Invalid network response');
            }
            return;
        },

        /**
         * GET /spendingtracker/api/v1/resendVerificationCode
         *
         * If previous code has expired, resends the verification code via email to the user
         * Returns 429 if limit has not passed or user reached the rate limit
         */
        async resendVerificationCode() {
            if (!pendingFetch) {
                throw new Error('Invalid state');
            }

            const response = await pendingFetch({
                url: '/spendingtracker/api/v1/resendVerificationCode',
                method: 'GET',
            });

            if (!response) return;

            const json = await safeJson(response);
            const parsed = validateAPIResponse(z.null().optional()).safeParse(json);
            if (!parsed.success) {
                throw new Error('Please try again.');
            }

            const result = parsed.data;
            if (response.status == 429) {
                throw new APIError(result.messages?.[0] ?? 'Too many requests. Please wait.', 429);
            }

            if (!response.ok) {
                throw new Error('Invalid network response');
            }
            return;
        },

        /**
         * POST /spendingtracker/api/v1/verify
         *
         * Attempts to verify the current user using the code supplied
         *
         * @params formData {verificationCode}
         */
        async verify(formData: FormData) {
            if (!pendingFetch) {
                throw new Error('Invalid state');
            }

            const response = await pendingFetch({
                url: '/spendingtracker/api/v1/verify',
                method: 'POST',
                body: formData,
            });

            if (!response) {
                throw new APIError('Invalid state', 401);
            }

            if (response.status == 429) {
                throw new APIError('Too many requests. Please wait.', 429);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = AuthAPIResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new APIError('Verify Validation failed: Invalid response format', response.status);
            }

            const result = parsed.data;

            if (result.error) {
                throw new APIError(result.messages?.[0] ?? 'Invalid or expired verification code.', 400);
            }

            // Return access token
            return result.data.access_token;
        },
    };
}
