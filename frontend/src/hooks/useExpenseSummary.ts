import { ExpenseSummaryContext } from 'contexts/ExpenseContext';
import { useContext } from 'react';

/**
 * Wrapper for the expense summary context (total + refetch only).
 */
export default function useExpenseSummary() {
    const context = useContext(ExpenseSummaryContext);
    if (!context) {
        throw new Error('useExpenseSummary must be used within a ExpenseContextProvider');
    }
    return context;
}
