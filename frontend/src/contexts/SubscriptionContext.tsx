import type { SelectChangeEvent } from '@mui/material/Select';
import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import useDateRangeContext from 'hooks/useDateRangeContext';
import usePaginatedFetch from 'hooks/usePaginatedFetch';
import useToastContext from 'hooks/useToastContext';
import type { ReactNode } from 'react';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { subscriptionService } from 'schema/subscription';
import type { Subscription } from 'types/Subscription.type';
import type { SubscriptionList } from 'types/SubscriptionList.type';
import { SubscriptionListSchema } from 'types/SubscriptionList.type';
import type { UsePaginatedFetchReturn } from 'types/UsePaginatedFetchReturn.type';

export interface SubscriptionContextType extends Omit<UsePaginatedFetchReturn<SubscriptionList>, 'data'> {
    subscriptions: Subscription[];
    totalSum: number | null;
    filteredSum: number | null;
    deleteSubscription: (subscriptionId: number) => Promise<void>;
    toggleSubscription: (row: Subscription) => Promise<void>;
    selectedInterval: string;
    handleIntervalChange: (event: SelectChangeEvent) => void;
}

export const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

/**
 * Subscription Context stores all information pertianing to the SubscriptionList widget
 *
 * Returns UsePaginatedFetchReturn structure and results from this
 */
export const SubscriptionContextProvider = ({ children }: { children: ReactNode }) => {
    const { formattedStartDate, formattedEndDate } = useDateRangeContext();
    const authFetch = useAuthFetch();
    const { authToken } = useAuthContext();
    const { showToast } = useToastContext();
    const subscriptionAPI = useMemo(() => subscriptionService(authFetch), [authFetch]);

    /**
     * Interval filtering in header
     */
    const [selectedInterval, setSelectedInterval] = useState<string>('');

    /**
     * Interval dropdown
     */
    const handleIntervalChange = useCallback((event: SelectChangeEvent) => {
        setSelectedInterval(event.target.value);
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    }, []);

    /**
     * Additional params used by API
     */
    const additionalParams = useMemo(
        () => ({
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            interval: selectedInterval,
        }),
        [formattedStartDate, formattedEndDate, selectedInterval]
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
        endpoint: '/spendingtracker/api/v1/subscriptions',
        initialPageSize: 10,
        additionalParams,
        validator: SubscriptionListSchema,
        defaultSort: [{ field: 'nextChargeDate', sort: 'asc' }],
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
     * Toggling subscription status
     */
    const toggleSubscription = useCallback(
        async (row: Subscription) => {
            try {
                const abortController = new AbortController();
                await subscriptionAPI.toggleSubscription(row, abortController.signal);

                // Refetch the current page and abort any inflight refetches
                await refetch(abortController.signal);
            } catch (err: unknown) {
                console.error('Error toggling subscription', err);
                showToast('Server Error. Please try again.', 'error');
            }
        },
        [subscriptionAPI, refetch, showToast]
    );

    /**
     * Deleting subscription
     */
    const deleteSubscription = useCallback(
        async (subscriptionId: number) => {
            try {
                const abortController = new AbortController();
                await subscriptionAPI.deleteSubscription(subscriptionId, abortController.signal);

                // Refetch the current page
                // Check if we need to go back a page
                const currentPageItemCount = totalRowCount;

                // If we deleted the last item on the last page that isn't the first page
                if (currentPageItemCount === 1 && paginationModel.page > 0) {
                    setPaginationModel({
                        ...paginationModel,
                        page: paginationModel.page - 1,
                    });
                } else {
                    await refetch(abortController.signal);
                }
            } catch (err: unknown) {
                console.error('Error deleting susbcription', err);
                showToast('Server Error. Please try again.', 'error');
            }
        },
        [subscriptionAPI, totalRowCount, paginationModel, setPaginationModel, refetch, showToast]
    );

    /**
     * Memoize the entire context
     */
    const value = useMemo<SubscriptionContextType>(
        () => ({
            subscriptions: data?.subscriptions ?? [],
            totalSum: data?.totalSum ?? null,
            filteredSum: data?.filteredSum ?? null,
            deleteSubscription,
            toggleSubscription,
            selectedInterval,
            handleIntervalChange,
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
            deleteSubscription,
            toggleSubscription,
            selectedInterval,
            handleIntervalChange,
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
        ]
    );

    return <SubscriptionContext value={value}>{children}</SubscriptionContext>;
};
