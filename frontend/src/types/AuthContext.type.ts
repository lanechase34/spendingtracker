/**
 * Credentials the user just entered, used to call /verify and /resendVerificationCode
 */
export interface PendingVerification {
    email: string;
    password: string;
    codeSent: boolean; // true when a code was just emailed (register), false for an unverified login (no email sent)
}

export interface AuthContextType {
    authToken: string | null;
    getLatestAuthToken: () => string | null;
    login: (token: string) => Promise<void>;
    logout: () => void;
    refreshToken: () => Promise<string | null>;
    getCsrfToken: (token: string, forceNew?: boolean) => Promise<string | null>;
    userJustLoggedIn: boolean;
    clearUserJustLoggedIn: () => void;

    // Credentials (in memory only) for an unverified user pending verification
    pendingVerification: PendingVerification | null;
    setPendingVerification: (pending: PendingVerification | null) => void;

    // Access token state for users pending 2FA verification
    pending2FAToken: string | null;
    setPending2FAToken: (token: string | null) => void;
    complete2FALogin: (token: string) => Promise<void>;

    // Auth loading states
    isInitializing: () => boolean;
}
