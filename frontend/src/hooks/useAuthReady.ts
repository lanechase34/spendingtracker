import useAuthContext from './useAuthContext';
import useUserContext from './useUserContext';

/**
 * Determine whether we are fully ready to start authenticated fetch requests
 * This only returns true if the user has the following
 *
 * 1. Valid JWT from /login
 * 2. User profile finished loading from /me
 * 3. User has a valid user object populated (with valid role) from userContext
 */
export default function useAuthReady() {
    const { authToken } = useAuthContext();
    const { loading, user } = useUserContext();

    return !!authToken && !loading && !!user;
}
