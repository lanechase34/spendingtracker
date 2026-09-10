import useAuthContext from 'hooks/useAuthContext';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Redirect to the dashboard as soon as a fresh login completes
 */
export default function PostLoginRedirect() {
    const { userJustLoggedIn, clearUserJustLoggedIn } = useAuthContext();
    const navigate = useNavigate();

    useEffect(() => {
        /**
         * Only redirect if this was a fresh login - not user navigating app themselves
         */
        if (userJustLoggedIn) {
            void navigate('/dashboard', { replace: true });
            clearUserJustLoggedIn();
        }
    }, [navigate, userJustLoggedIn, clearUserJustLoggedIn]);

    return null;
}
