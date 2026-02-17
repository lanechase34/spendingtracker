import { AuthContext } from 'contexts/AuthContext';
import { useContext } from 'react';

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
