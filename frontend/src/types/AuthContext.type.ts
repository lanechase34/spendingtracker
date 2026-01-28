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

    // Auth loading states
    isInitializing: () => boolean;
    isAuthenticated: () => boolean;
    wasAuthenticated: boolean;
}
