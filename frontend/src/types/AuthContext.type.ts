export interface AuthContextType {
    authToken: string | null;
    getLatestAuthToken: () => string | null;
    login: (token: string | null) => Promise<void>;
    logout: () => void;
    refreshToken: () => Promise<string | null>;
    csrfToken: string | null;
    getCsrfToken: (token: string, forceNew?: boolean) => Promise<string | null>;
    userJustLoggedIn: boolean;
    clearUserJustLoggedIn: () => void;

    // Access token state for unverified users pending verification
    pendingToken: string | null;
    setPendingToken: (token: string | null) => void;

    // Access token state for users pending 2FA verification
    pending2FAToken: string | null;
    setPending2FAToken: (token: string | null) => void;
    complete2FALogin: (token: string) => Promise<void>;

    // Auth loading states
    isInitializing: () => boolean;
    isAuthenticated: () => boolean;
    wasAuthenticated: boolean;
}
