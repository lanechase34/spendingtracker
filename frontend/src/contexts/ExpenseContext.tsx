import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import useDateRangeContext from 'hooks/useDateRangeContext';
import { useInvalidateWidgets } from 'hooks/useInvalidateWidgets';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import useToastContext from 'hooks/useToastContext';
import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo } from 'react';
import type { APIResponseType } from 'types/APIResponse.type';
import type { Expense } from 'types/Expense.type';
import type { ExpenseList } from 'types/ExpenseList.type';
import { ExpenseListSchema } from 'types/ExpenseList.type';
import type { UsePaginatedFetchReturn } from 'types/UsePaginatedFetchReturn.type';

export interface ExpenseContextType extends Omit<UsePaginatedFetchReturn<ExpenseList>, 'data'> {
    expenses: Expense[];
    totalSum: number | null;
    filteredSum: number | null;
    deleteExpense: (expenseId: number) => Promise<void>;
}

export const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

/**
 * Expense Context stores all information pertaining to the ExpenseList widget
 *
 * Returns UsePaginatedFetchReturn structure and results from this
 */
export const ExpenseContextProvider = ({ children }: { children: ReactNode }) => {
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
        endpoint: '/spendingtracker/api/v1/expenses',
        initialPageSize: 10,
        additionalParams,
        validator: ExpenseListSchema,
        defaultSort: [{ field: 'date', sort: 'desc' }],
    });

    /**
     * Reset state on logout
     */
    useEffect(() => {
        if (!authToken) {
            resetState();
        }
    }, [authToken, resetState]);

    /**
     * deleteExpense function
     * Keep stable reference of function
     */
    const deleteExpense = useCallback(
        async (expenseId: number) => {
            try {
                const response = await authFetch({
                    url: `/spendingtracker/api/v1/expenses/${expenseId}`,
                    method: 'DELETE',
                });

                if (!response) return;
                if (!response.ok) throw new Error('Invalid network response');

                const result = (await response.json()) as APIResponseType<null>;
                if (result.error) throw new Error('Bad Request');

                // Refetch the current page
                // Check if we need to go back a page
                const currentPageItemCount = data?.expenses?.length ?? 0;

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
        [authFetch, data?.expenses?.length, paginationModel, setPaginationModel, refetch, showToast, invalidateWidgets]
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

    return <ExpenseContext value={value}>{children}</ExpenseContext>;
};
