import type useAuthFetch from 'hooks/useAuthFetch';
import type usePendingFetch from 'hooks/usePendingFetch';
import type { usePending2FAFetch } from 'hooks/usePendingFetch';
import { APIError } from 'utils/apiError';
import { API_BASE_URL } from 'utils/constants';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

/**
 * API return formats for:
 * /verify2fa (Actual JWT on success)
 * /register (Pending JWT)
 * /verify (Actual JWT on success)
 */
const AuthAPIResponseSchema = validateAPIResponse(
    z.object({
        access_token: z.string().min(2),
    })
);

/**
 * API return format for /login
 * Includes the optional mfa_required flag
 *
 * If mfa_required is true, the access_token only allows the /verify2fa endpoint to be reached
 */
const LoginAPIResponseSchema = validateAPIResponse(
    z.object({
        access_token: z.string().min(2),
        mfa_required: z.boolean().optional(),
    })
);

/**
 * API Return format for
 * /me/2fa/setup
 */
const Setup2FAResponseSchema = validateAPIResponse(
    z.object({
        qrCode: z.string(),
        secret: z.string(),
    })
);

/**
 * Api Return format for
 * /me/2fa/confirm
 */
const Confirm2FAResponseSchema = validateAPIResponse(
    z.object({
        recoveryCodes: z.array(z.string()),
    })
);

const Disable2FAResponseSchema = validateAPIResponse(z.undefined().optional());

interface LoginResult {
    access_token: string;
    mfa_required?: boolean;
}

interface UserServiceParams {
    authFetch?: ReturnType<typeof useAuthFetch>;
    pendingFetch?: ReturnType<typeof usePendingFetch>;
    pending2FAFetch?: ReturnType<typeof usePending2FAFetch>;
}

type Setup2FAResult = Extract<z.infer<typeof Setup2FAResponseSchema>, { error: false }>['data'];
type Confirm2FAResult = Extract<z.infer<typeof Confirm2FAResponseSchema>, { error: false }>['data'];

/**
 * Service layer for the user API endpoints
 */
export function userService({ authFetch, pendingFetch, pending2FAFetch }: UserServiceParams) {
    return {
        /**
         * POST /login
         * Login a user and receive their JWT
         * If 2FA is enabled, returns a pending token with mfa_required: true
         *
         * @param formData {email, password}
         * @returns access_token
         */
        async login(formData: FormData): Promise<LoginResult> {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                body: formData,
            });

            if (response.status === 429) {
                throw new APIError('Too many requests. Please wait.', 429);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = LoginAPIResponseSchema.safeParse(json);

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

            // Return access token and mfa_required flag
            return {
                access_token: result.data.access_token,
                mfa_required: result.data.mfa_required,
            };
        },

        /**
         * POST /logout
         *
         * Invalidates JWT
         */
        async logout() {
            if (!authFetch) return;
            const response = await authFetch({
                url: `${API_BASE_URL}/security/logout`,
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
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 429) {
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
         * PATCH /me
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
                url: `${API_BASE_URL}/me`,
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
         * GET /resendVerificationCode
         *
         * If previous code has expired, resends the verification code via email to the user
         * Returns 429 if limit has not passed or user reached the rate limit
         */
        async resendVerificationCode() {
            if (!pendingFetch) {
                throw new Error('Invalid state');
            }

            const response = await pendingFetch({
                url: `${API_BASE_URL}/resendVerificationCode`,
                method: 'GET',
            });

            if (!response) return;

            const json = await safeJson(response);
            const parsed = validateAPIResponse(z.null().optional()).safeParse(json);
            if (!parsed.success) {
                throw new Error('Please try again.');
            }

            const result = parsed.data;
            if (response.status === 429) {
                throw new APIError(result.messages?.[0] ?? 'Too many requests. Please wait.', 429);
            }

            if (!response.ok) {
                throw new Error('Invalid network response');
            }
            return;
        },

        /**
         * POST /verify2fa
         * Verify the 2FA code during login using the pending 2FA token
         * Accepts either a 6-digit TOTP code or a recovery code (xxxx-xxxx-xxxx-xxxx)
         *
         * @params formData {code - The TOTP code or recovery code}
         * @returns access_token - the full user JWT
         */
        async verify2fa(formData: FormData) {
            if (!pending2FAFetch) {
                throw new Error('Invalid state');
            }

            const response = await pending2FAFetch({
                url: `${API_BASE_URL}/verify2fa`,
                method: 'POST',
                body: formData,
            });

            if (!response) {
                throw new APIError('Invalid state', 401);
            }

            if (response.status === 429) {
                throw new APIError('Too many requests. Please wait.', 429);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = AuthAPIResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new APIError('Invalid response format.', response.status);
            }

            const result = parsed.data;

            if (result.error || !response.ok) {
                throw new APIError(result.messages?.[0] ?? 'Invalid or expired code.', response.status);
            }

            // Return access token
            return result.data.access_token;
        },

        /**
         * POST /verify
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
                url: `${API_BASE_URL}/verify`,
                method: 'POST',
                body: formData,
            });

            if (!response) {
                throw new APIError('Invalid state', 401);
            }

            if (response.status === 429) {
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

        /**
         * POST /me/2fa/setup
         *
         * Initiates 2FA setup - returns QR code (base64 encoded img tag) and plain text secret
         */
        async setup2fa(): Promise<Setup2FAResult> {
            if (!authFetch) {
                throw new Error('Invalid state');
            }

            const response = await authFetch({
                url: `${API_BASE_URL}/me/2fa/setup`,
                method: 'POST',
            });

            if (!response) {
                throw new APIError('Invalid state', 401);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = Setup2FAResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new APIError('Validation failed: Invalid response format', response.status);
            }

            const result = parsed.data;

            if (result.error) {
                throw new APIError(result.messages?.[0] ?? 'Failed to initiate 2FA setup.', response.status);
            }

            return result.data;
        },

        /**
         * POST /me/2fa/confirm
         * Confirms 2FA setup with a valid TOTP code - returns recovery codes shown once only
         *
         * @param code The 6-digit code from the authenticator app
         */
        async confirm2fa(code: string): Promise<Confirm2FAResult> {
            if (!authFetch) {
                throw new Error('Invalid state');
            }

            const response = await authFetch({
                url: `${API_BASE_URL}/me/2fa/confirm`,
                method: 'POST',
                body: { code },
            });

            if (!response) {
                throw new APIError('Invalid state', 401);
            }

            if (response.status === 429) {
                throw new APIError('Too many requests. Please wait.', 429);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = Confirm2FAResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new APIError('Validation failed: Invalid response format', response.status);
            }

            const result = parsed.data;
            if (result.error) {
                throw new APIError(result.messages?.[0] ?? 'Invalid or expired code.', response.status);
            }

            return result.data;
        },

        /**
         * POST /me/2fa/disable
         * Disables 2FA after verifying current TOTP code or recovery code
         *
         * @param code The 6-digit TOTP code or recovery code
         */
        async disable2fa(code: string): Promise<void> {
            if (!authFetch) {
                throw new Error('Invalid state');
            }

            const response = await authFetch({
                url: `${API_BASE_URL}/me/2fa/disable`,
                method: 'POST',
                body: { code },
            });

            if (!response) {
                throw new APIError('Invalid state', 401);
            }

            if (response.status === 429) {
                throw new APIError('Too many requests. Please wait.', 429);
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = Disable2FAResponseSchema.safeParse(json);

            if (!parsed.success) {
                throw new APIError('Validation failed: Invalid response format', response.status);
            }

            const result = parsed.data;
            if (result.error) {
                throw new APIError(result.messages?.[0] ?? 'Invalid or expired code.', response.status);
            }

            return;
        },
    };
}
