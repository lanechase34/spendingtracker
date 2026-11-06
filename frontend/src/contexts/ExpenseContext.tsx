import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useInvalidateWidgets } from 'hooks/useInvalidateWidgets';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import useToastContext from 'hooks/useToastContext';
import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo } from 'react';
import type { Expense } from 'types/Expense.type';
import type { ExpenseList } from 'types/ExpenseList.type';
import { ExpenseListSchema } from 'types/ExpenseList.type';
import type { UsePaginatedFetchReturn } from 'types/UsePaginatedFetchReturn.type';
import { API_BASE_URL } from 'utils/constants';
import { safeJson } from 'utils/safeJson';
import { NoDataAPIResponseSchema } from 'validators/validateAPIResponse';

export interface ExpenseContextType extends Omit<UsePaginatedFetchReturn<ExpenseList>, 'data'> {
    expenses: Expense[];
    totalSum: number | null;
    filteredSum: number | null;
    deleteExpense: (expenseId: number) => Promise<void>;
}

export const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

/**
 * Narrow slice of the expense context for components that only need the total or to trigger a refetch
 * Only changes when the total changes, so these consumers don't re-render on every grid interaction
 */
export interface ExpenseSummaryContextType {
    totalSum: number | null;
    refetch: () => Promise<void>;
}

export const ExpenseSummaryContext = createContext<ExpenseSummaryContextType | undefined>(undefined);

/**
 * Expense Context stores all information pertaining to the ExpenseList widget
 *
 * Returns UsePaginatedFetchReturn structure and results from this
 * @enabled only fetch while true - the provider stays mounted so its consumers (navbar expense form) always have a context
 */
export const ExpenseContextProvider = ({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) => {
    const { formattedStartDate, formattedEndDate } = useDateRangeContext();
    const authFetch = useAuthFetch();
    const { authToken } = useAuthContext();
    const { showToast } = useToastContext();
    const invalidateWidgets = useInvalidateWidgets();

    /**
     * Additional params used by API
     */
    const additionalParams = useMemo(
        () => ({
            startDate: formattedStartDate,
            endDate: formattedEndDate,
        }),
        [formattedStartDate, formattedEndDate]
    );

    /**
     * usePaginatedFetch hook
     */
    const {
        data,
        loading,
        error,
        paginationModel,
        setPaginationModel,
        sortModel,
        setSortModel,
        filterModel,
        setFilterModel,
        totalRowCount,
        refetch,
        resetState,
        handlePaginationModelChange,
        handleSortModelChange,
        handleFilterModelChange,
    } = usePaginatedFetch({
        endpoint: `${API_BASE_URL}/expenses`,
        initialPageSize: 10,
        additionalParams,
        enabled,
        validator: ExpenseListSchema,
        defaultSort: [{ field: 'date', sort: 'desc' }],
    });

    /**
     * Reset state on logout
     */
    useEffect(() => {
        if (authToken == null) {
            resetState();
        }
    }, [authToken, resetState]);

    const currentPageItemCount = data?.expenses.length ?? 0;

    /**
     * deleteExpense function
     * Keep stable reference of function
     */
    const deleteExpense = useCallback(
        async (expenseId: number) => {
            try {
                const response = await authFetch({
                    url: `${API_BASE_URL}/expenses/${String(expenseId)}`,
                    method: 'DELETE',
                });

                if (!response) return;
                if (!response.ok) throw new Error('Invalid network response');

                const parsed = NoDataAPIResponseSchema.safeParse(await safeJson(response));
                if (!parsed.success || parsed.data.error) throw new Error('Bad Request');

                // Refetch the current page
                // Check if we need to go back a page
                // If we deleted the last item on the last page that isn't the first page
                if (currentPageItemCount === 1 && paginationModel.page > 0) {
                    setPaginationModel({
                        ...paginationModel,
                        page: paginationModel.page - 1,
                    });
                } else {
                    await refetch();
                }

                // Refetch Widgets
                invalidateWidgets();
            } catch (err: unknown) {
                console.error('Error deleting expense', err);
                showToast('Server Error. Please try again.', 'error');
            }
        },
        [authFetch, currentPageItemCount, paginationModel, setPaginationModel, refetch, showToast, invalidateWidgets]
    );

    /**
     * Memoize the entire context
     */
    const value = useMemo<ExpenseContextType>(
        () => ({
            expenses: data?.expenses ?? [],
            totalSum: data?.totalSum ?? null,
            filteredSum: data?.filteredSum ?? null,
            deleteExpense,
            loading,
            error,
            paginationModel,
            setPaginationModel,
            sortModel,
            setSortModel,
            filterModel,
            setFilterModel,
            totalRowCount,
            refetch,
            resetState,
            handlePaginationModelChange,
            handleSortModelChange,
            handleFilterModelChange,
        }),
        [
            data,
            loading,
            error,
            paginationModel,
            sortModel,
            filterModel,
            totalRowCount,
            deleteExpense,
            refetch,
            resetState,
            handlePaginationModelChange,
            handleSortModelChange,
            handleFilterModelChange,
            setPaginationModel,
            setSortModel,
            setFilterModel,
        ]
    );

    const totalSum = data?.totalSum ?? null;
    const summaryValue = useMemo<ExpenseSummaryContextType>(() => ({ totalSum, refetch }), [totalSum, refetch]);

    return (
        <ExpenseSummaryContext value={summaryValue}>
            <ExpenseContext value={value}>{children}</ExpenseContext>
        </ExpenseSummaryContext>
    );
};
