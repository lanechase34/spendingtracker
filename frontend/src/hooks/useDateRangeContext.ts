import { DateRangeContext } from 'contexts/DateRangeContext';
import { useContext } from 'react';

/**
 * Wrapper for the date range context.
 */
export default function useDateRangeContext() {
    const context = useContext(DateRangeContext);
    if (!context) {
        throw new Error('useDateRangeContext must be used within a DateRangeContextProvider');
    }
    return context;
}
