import { UserContext } from 'contexts/UserContext';
import { useContext } from 'react';

/**
 * Wrapper for the user context.
 */
export default function useUserContext() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUserContext must be used within a UserContextProvider');
    }
    return context;
}
