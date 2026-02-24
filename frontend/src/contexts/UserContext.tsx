import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { UserRoles } from 'types/Roles.type';
import type { User, UserContextType } from 'types/UserContext.type';
import { UserResponseSchema } from 'types/UserContext.type';

export const UserContext = createContext<UserContextType | undefined>(undefined);

/**
 * Context is managed inside provider, use hook when needed access
 * UserContext to store the following:
 *
 * salary
 * monthlyTakeHome
 * settings
 * roles
 */
export const UserContextProvider = ({ children }: { children: ReactNode }) => {
    const { authToken, isInitializing } = useAuthContext();
    const authFetch = useAuthFetch();

    /**
     * User Profile information
     */
    const [loading, setLoading] = useState<boolean>(true);
    const [userProfile, setUserProfile] = useState<User | null>(null);

    /**
     * Track if we've already loaded the profile for this authToken
     */
    const hasLoadedProfileRef = useRef<boolean>(false);

    const loadProfile = useEffectEvent(async (signal: AbortSignal) => {
        setLoading(true);

        try {
            const response = await authFetch({
                url: '/spendingtracker/api/v1/me',
                method: 'GET',
                signal: signal,
            });

            if (!response) return;

            const rawJson: unknown = await response.json();

            // Validate response
            const valid = UserResponseSchema.safeParse(rawJson);
            if (!valid.success) {
                throw new Error('Invalid response');
            }

            const result = valid.data;
            if (result.error) {
                throw new Error('Bad Request');
            }

            setUserProfile({
                salary: result.data.salary,
                monthlyTakeHome: result.data.monthlytakehome,
                role: result.data.role,
            });

            hasLoadedProfileRef.current = true;
        } catch (error) {
            if (signal.aborted) {
                return;
            }
            console.error('Failed to load user profile:', error);
            setUserProfile(null);
            hasLoadedProfileRef.current = false;
        } finally {
            if (!signal.aborted) {
                setLoading(false);
            }
        }
    });

    /**
     * Get user profile when token refreshes
     */
    useEffect(() => {
        // Wait for refresh token to finish its attempt
        if (isInitializing()) {
            return;
        }

        // Reset profile on logout or invalid auth token
        if (!authToken) {
            setLoading(false);
            setUserProfile(null);
            hasLoadedProfileRef.current = false;
            return;
        }

        // If this profile has already been loaded this session
        if (hasLoadedProfileRef.current) {
            return;
        }

        const abortController = new AbortController();
        void loadProfile(abortController.signal);

        return () => {
            abortController.abort();
        };
    }, [authToken, isInitializing]);

    const isAuthorized = useCallback(() => {
        return userProfile !== null && (userProfile?.role ?? '').length > 0;
    }, [userProfile]);

    const hasRole = useCallback((role: UserRoles) => userProfile?.role === role, [userProfile]);

    const value: UserContextType = useMemo(
        () => ({
            user: userProfile,
            loading: loading,
            isAuthorized: isAuthorized,
            hasRole: hasRole,
        }),
        [userProfile, loading, isAuthorized, hasRole]
    );

    return <UserContext value={value}>{children}</UserContext>;
};
