import { AdminDrawerContext } from 'contexts/AdminDrawerContext';
import { useContext } from 'react';

/**
 * Wrapper for the AdminDrawer Context
 */
export default function useAdminDrawerContext() {
    const context = useContext(AdminDrawerContext);
    if (!context) {
        throw new Error('useAdminDrawerContext must be used within AdminDrawerContextProvider');
    }
    return context;
}
