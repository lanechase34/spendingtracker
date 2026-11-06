import type { GridFilterModel, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import useAuthFetch from 'hooks/useAuthFetch';
import useAuthReady from 'hooks/useAuthReady';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UsePaginatedFetchReturn } from 'types/UsePaginatedFetchReturn.type';
import { getErrorInfo } from 'utils/errorInfo';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

// The envelope is validated here; the data payload is validated by the caller's validator
const APIResponseSchema = validateAPIResponse(z.unknown());

// Generic Hook Arguments
interface PaginatedFetch<TValidator extends z.ZodType> {
    endpoint: string;
    initialPageSize?: number;
    additionalParams?: Record<string, string>;
    validator: TValidator; // Zod schema for validation against raw api response - the type is also inferred from this schema
    defaultSort?: GridSortModel;
    enabled?: boolean; // When false, no fetches are made (e.g. the widget's page isn't mounted)
}

// State for the Data Grid
interface GridState {
    paginationModel: GridPaginationModel;
    sortModel: GridSortModel;
    filterModel: GridFilterModel;
}

/**
 * usePaginatedFetch hook for data grid
 * Handles fetching new data whenever page, sort, filter, and additional params change
 * @endpoint api endpoint
 * @initialPageSize data grid initial page size
 * @additionalParams key-value pairs of additional params to add to fetch call
 * @validator validator for type T passed in
 * @enabled only fetch while true
 * @returns
 */
export default function usePaginatedFetch<TValidator extends z.ZodType>({
    endpoint,
    initialPageSize = 10,
    additionalParams = {},
    validator,
    defaultSort = [],
    enabled = true,
}: PaginatedFetch<TValidator>): UsePaginatedFetchReturn<z.infer<TValidator>> {
    type TData = z.infer<TValidator>; // Infer the type of the data from the validator

    const [data, setData] = useState<TData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<boolean>(false);
    const [totalRowCount, setTotalRowCount] = useState<number>(0);

    const authFetch = useAuthFetch();
    const authReady = useAuthReady();

    const defaultSortRef = useRef<GridSortModel>(defaultSort);

    /**
     * Grid State
     * Keep everything in single state - separate state updates would cause separate renders
     */
    const [gridState, setGridState] = useState<GridState>({
        paginationModel: { page: 0, pageSize: initialPageSize },
        sortModel: defaultSort,
        filterModel: { quickFilterValues: [], items: [] },
    });

    /**
     * React performs a reference equality check, not a deep equality check.
     * This will ensure we are checking the values of the gridState
     */
    const serializedGridState = useMemo(() => JSON.stringify(gridState), [gridState]);

    /**
     * Create stable reference to the additonal params query string
     */
    const additionalParamsString = useMemo(() => new URLSearchParams(additionalParams).toString(), [additionalParams]);

    /**
     * Reset to the first page when the additional params (date range, interval, etc.) change
     * Adjusted during render so the fetch effect only runs once, with the reset page
     */
    const [prevAdditionalParamsString, setPrevAdditionalParamsString] = useState(additionalParamsString);
    if (prevAdditionalParamsString !== additionalParamsString) {
        setPrevAdditionalParamsString(additionalParamsString);
        if (gridState.paginationModel.page !== 0) {
            setGridState((prev) => ({ ...prev, paginationModel: { ...prev.paginationModel, page: 0 } }));
        }
    }

    /**
     * Only one request is in flight at a time - starting a new one (effect or refetch) aborts the previous
     * so a slower, older response can never overwrite newer data
     */
    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Latest grid state and params, so refetch can keep a stable reference
     */
    const latestRef = useRef({ gridState, additionalParamsString, enabled });
    useEffect(() => {
        latestRef.current = { gridState, additionalParamsString, enabled };
    }, [gridState, additionalParamsString, enabled]);

    /**
     * Helper to get the full filter from the filter modal, returns '' if no filter present
     */
    const getFilter = useCallback((state: GridState) => {
        return state.filterModel.quickFilterValues?.join(' ') ?? '';
    }, []);

    /**
     * Aggregates the params set by pagination, filter, and sorting
     */
    const getFetchParams = useCallback(
        (state: GridState) => {
            const quickFilter = getFilter(state);
            const sortStruct = state.sortModel[0];

            const urlParams = new URLSearchParams({
                page: (state.paginationModel.page + 1).toString(), // api first page is 1, data grid starts at 0
                records: state.paginationModel.pageSize.toString(),
                orderCol: sortStruct?.field ?? '',
                orderDir: sortStruct ? (sortStruct.sort ?? 'asc') : '',
                search: quickFilter,
            });

            return urlParams.toString();
        },
        [getFilter]
    );

    /**
     * Fetch handler. Will call endpoint and aggregate mui data grid params + additional params passed in
     */
    const fetchData = useCallback(
        async (state: GridState, additionalParamsString: string) => {
            abortControllerRef.current?.abort();
            const controller = new AbortController();
            abortControllerRef.current = controller;
            const { signal } = controller;
            const isCurrent = () => abortControllerRef.current === controller && !signal.aborted;

            setLoading(true);
            setError(false);

            try {
                const fetchParams = getFetchParams(state);
                const response = await authFetch({
                    url: `${endpoint}?${fetchParams}&${additionalParamsString}`,
                    method: 'GET',
                    signal,
                });

                if (!isCurrent()) return;
                if (!response) {
                    setLoading(false);
                    return;
                }
                if (!response.ok) throw new Error('Invalid network response');

                // Validate the response
                const json = await safeJson(response);
                const parsed = APIResponseSchema.safeParse(json);

                if (!parsed.success) throw new Error('Invalid response');

                const result = parsed.data;
                if (result.error) throw new Error('Bad Request');

                const dataParsed = validator.safeParse(result.data);
                if (!dataParsed.success) throw new Error('Invalid response');
                if (!isCurrent()) return;
                setData(dataParsed.data);

                // Filtered count when searching, otherwise the total
                setTotalRowCount(result.pagination?.filteredRecords ?? result.pagination?.totalRecords ?? 0);
                setLoading(false);
            } catch (err: unknown) {
                const errorInfo = getErrorInfo(err);
                if (errorInfo.name !== 'AbortError' && isCurrent()) {
                    console.error(`Error fetching data from ${endpoint}:`, err);
                    setError(true);
                    setLoading(false);
                }
            }
        },
        [authFetch, endpoint, validator, getFetchParams]
    );

    /**
     * Fetch data when the pagination, filter, sort, or additional params changes
     * Aborts the previous fetch if re-triggered
     */
    useEffect(() => {
        if (!authReady || !enabled) return;

        // eslint-disable-next-line react-hooks/set-state-in-effect -- fetching is the external sync this effect exists for
        void fetchData(gridState, additionalParamsString);

        return () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps -- serialized grid state controls WHEN the effect runs
    }, [serializedGridState, additionalParamsString, authReady, enabled, fetchData]);

    /**
     * Expose same effect as a function
     * Stable reference - reads the latest grid state from a ref
     * No-op while disabled - the fetch effect loads fresh data once enabled again
     */
    const refetch = useCallback(async () => {
        const {
            gridState: latestGridState,
            additionalParamsString: latestParams,
            enabled: isEnabled,
        } = latestRef.current;
        if (!isEnabled) return;
        await fetchData(latestGridState, latestParams);
    }, [fetchData]);

    /**
     * Expose function to reset state to default values
     */
    const resetState = useCallback(() => {
        setData(null);
        setLoading(false);
        setError(false);
        setTotalRowCount(0);
        setGridState({
            paginationModel: { page: 0, pageSize: initialPageSize },
            sortModel: defaultSortRef.current,
            filterModel: { quickFilterValues: [], items: [] },
        });
    }, [initialPageSize]);

    /**
     * MUI Grid Actions
     */
    const handlePaginationModelChange = useCallback((newPaginationModel: GridPaginationModel) => {
        // Reset to first page if page size changes
        setGridState((prev) => ({
            ...prev,
            paginationModel: {
                page: newPaginationModel.pageSize !== prev.paginationModel.pageSize ? 0 : newPaginationModel.page,
                pageSize: newPaginationModel.pageSize,
            },
        }));
    }, []);

    const handleFilterModelChange = useCallback((newFilterModel: GridFilterModel) => {
        // Reset to the first page
        setGridState((prev) => ({
            ...prev,
            paginationModel: { ...prev.paginationModel, page: 0 },
            filterModel: newFilterModel,
        }));
    }, []);

    const handleSortModelChange = useCallback((newSortModel: GridSortModel) => {
        // Reset to the first page
        setGridState((prev) => ({
            ...prev,
            paginationModel: { ...prev.paginationModel, page: 0 },
            sortModel: newSortModel,
        }));
    }, []);

    const setPaginationModel = useCallback((model: GridPaginationModel) => {
        setGridState((prev) => ({ ...prev, paginationModel: model }));
    }, []);

    const setSortModel = useCallback((model: GridSortModel) => {
        setGridState((prev) => ({ ...prev, sortModel: model }));
    }, []);

    const setFilterModel = useCallback((model: GridFilterModel) => {
        setGridState((prev) => ({ ...prev, filterModel: model }));
    }, []);

    return {
        data,
        loading,
        error,
        paginationModel: gridState.paginationModel,
        setPaginationModel,
        sortModel: gridState.sortModel,
        setSortModel,
        filterModel: gridState.filterModel,
        setFilterModel,
        totalRowCount,
        refetch,
        resetState,
        handlePaginationModelChange,
        handleSortModelChange,
        handleFilterModelChange,
    };
}
