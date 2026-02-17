import { ExpenseContext } from 'contexts/ExpenseContext';
import { useContext } from 'react';

/**
 * Wrapper for the expense context.
 */
export default function useExpenseContext() {
    const context = useContext(ExpenseContext);
    if (!context) {
        throw new Error('useExpenseContext must be used within a ExpenseContextProvider');
    }
    return context;
}
