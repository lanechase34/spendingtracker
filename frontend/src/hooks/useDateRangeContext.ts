import { useContext } from 'react';
import { DateRangeContext } from 'contexts/DateRangeContext';

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
