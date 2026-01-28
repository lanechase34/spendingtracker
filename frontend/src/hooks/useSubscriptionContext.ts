import { useContext } from 'react';
import { SubscriptionContext } from 'contexts/SubscriptionContext';

/**
 * Wrapper for the Subscription context.
 */
export default function useSubscriptionContext() {
    const context = useContext(SubscriptionContext);
    if (!context) {
        throw new Error('useSubscriptionContext must be used within a SubscriptionContextProvider');
    }
    return context;
}
