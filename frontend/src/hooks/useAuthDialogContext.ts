import { useContext } from 'react';
import { AuthDialogContext } from 'contexts/AuthDialogContext';

/**
 * Wrapper for the Auth context.
 */
export default function useAuthDialogContext() {
    const context = useContext(AuthDialogContext);
    if (!context) {
        throw new Error('useAuthDialogContext must be used within a AuthDialogContextProvider');
    }
    return context;
}
