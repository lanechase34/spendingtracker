import { ToastContext } from 'contexts/ToastContext';
import { useContext } from 'react';

/**
 * Wrapper for the toast context.
 */
export default function useToastContext() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToastContextContext must be used within a ToastContextContextProvider');
    }
    return context;
}
