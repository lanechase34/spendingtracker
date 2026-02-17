import useAuthContext from 'hooks/useAuthContext';
import useUserContext from 'hooks/useUserContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Redirect when the user context finishes loading AND the user exists
 */
export default function PostLoginRedirect() {
    const { userJustLoggedIn, clearUserJustLoggedIn } = useAuthContext();
    const { loading, isAuthorized } = useUserContext();
    const navigate = useNavigate();

    useEffect(() => {
        if (loading) return;

        /**
         * Only redirect if this was a fresh login - not user navigating app themselves
         */
        if (isAuthorized?.() && userJustLoggedIn) {
            void navigate('/dashboard', { replace: true });
            clearUserJustLoggedIn();
        }
    }, [loading, isAuthorized, navigate, userJustLoggedIn, clearUserJustLoggedIn]);

    return null;
}
