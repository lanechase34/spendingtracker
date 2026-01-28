import { useContext } from 'react';
import { AuthContext } from 'contexts/AuthContext';

/**
 * Wrapper for the Auth context.
 */
export default function useAuthContext() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within a AuthContextProvider');
    }
    return context;
}
