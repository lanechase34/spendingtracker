import { SubscriptionSummaryContext } from 'contexts/SubscriptionContext';
import { useContext } from 'react';

/**
 * Wrapper for the subscription summary context (total + refetch only).
 */
export default function useSubscriptionSummary() {
    const context = useContext(SubscriptionSummaryContext);
    if (!context) {
        throw new Error('useSubscriptionSummary must be used within a SubscriptionContextProvider');
    }
    return context;
}
