import type { GridFilterModel, GridPaginationModel,GridSortModel } from '@mui/x-data-grid';
import useAuthFetch from 'hooks/useAuthFetch';
import useAuthReady from 'hooks/useAuthReady';
import { useCallback, useEffect, useMemo, useRef,useState } from 'react';
import type { UsePaginatedFetchReturn } from 'types/UsePaginatedFetchReturn.type';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import type { z } from 'zod';

// Generic Hook Arguments
interface PaginatedFetch<TValidator extends z.ZodType> {
    endpoint: string;
    initialPageSize?: number;
    additionalParams?: Record<string, string>;
    validator: TValidator; // Zod schema for validation against raw api response - the type is also inferred from this schema
    defaultSort?: GridSortModel;
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
 * @returns
 */
export default function usePaginatedFetch<TValidator extends z.ZodType>({
    endpoint,
    initialPageSize = 10,
    additionalParams = {},
    validator,
    defaultSort = [],
}: PaginatedFetch<TValidator>): UsePaginatedFetchReturn<z.infer<TValidator>> {
    type TData = z.infer<TValidator>; // Infer the type of the data from the validator

    const [data, setData] = useState<TData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<boolean>(false);
    const [totalRowCount, setTotalRowCount] = useState<number>(0);

    const APIResponseSchema = useMemo(() => validateAPIResponse(validator), [validator]);
    const authFetch = useAuthFetch();
    const authReady = useAuthReady();

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
     * Helper to get the full filter from the filter modal, returns '' if no filter present
     */
    const getFilter = useCallback((state: GridState) => {
        return state.filterModel?.quickFilterValues?.join(' ') ?? '';
    }, []);

    /**
     * Aggregates the params set by pagination, filter, and sorting
     */
    const getFetchParams = useCallback(
        (state: GridState) => {
            const quickFilter = getFilter(state);
            const sortStruct = state.sortModel.length ? state.sortModel[0] : { field: '', sort: '' };

            const urlParams = new URLSearchParams({
                page: (state.paginationModel.page + 1).toString(), // api first page is 1, data grid starts at 0
                records: state.paginationModel.pageSize.toString(),
                orderCol: sortStruct.field,
                orderDir: sortStruct?.sort ?? 'asc',
                search: quickFilter,
            });

            return `${urlParams.toString()}`;
        },
        [getFilter]
    );

    /**
     * Keep a single abortController reference to share between fetchData and refetch
     */
    const abortControllerRef = useRef<AbortController | null>(null);

    /**
     * Fetch handler. Will call endpoint and aggregate mui data grid params + additional params passed in
     * If successful response, transform the result.data based on transform function
     */
    const fetchData = useCallback(
        async (state: GridState, additionalParamsString: string, signal?: AbortSignal) => {
            setLoading(true);
            setError(false);

            const controller = new AbortController();
            abortControllerRef.current = controller;
            const fetchSignal = signal ?? controller.signal;

            try {
                const fetchParams = getFetchParams(state);
                const response = await authFetch({
                    url: `${endpoint}?${fetchParams}&${additionalParamsString}`,
                    method: 'GET',
                    signal: fetchSignal,
                });

                if (!response) return;
                if (!response.ok) {
                    throw new Error('Invalid network response');
                }

                // Validate the response data
                const json = await safeJson(response);
                const parsed = APIResponseSchema.safeParse(json);

                if (!parsed.success) {
                    throw new Error('Invalid response');
                }

                const result = parsed.data;

                if (result.error === true) {
                    throw new Error('Bad Request');
                }

                // @ts-expect-error We are guaranteed to have data matching TData because we passed zod validation
                setData(result.data as TData);

                const filtered = result.pagination?.filteredRecords ?? 0;
                const total = result.pagination?.totalRecords ?? 0;
                setTotalRowCount(filtered !== total ? filtered : total);
                setLoading(false);
            } catch (err: unknown) {
                const errorInfo = err as { name?: string; message?: string };
                if (errorInfo.name !== 'AbortError') {
                    console.error(`Error fetching data from ${endpoint}:`, err);
                    setError(true);
                    setLoading(false);
                }
            } finally {
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null;
                }
            }
        },
        [authFetch, endpoint, APIResponseSchema, getFetchParams]
    );

    /**
     * Fetch data when the pagination, filter, sort, or additional params changes
     * Aborts the previous fetch if re-triggered
     */
    useEffect(() => {
        if (!authReady) return; // this is a problem because this depends on auth fetch, which it really shouldn't be retriggering when that updates
        // this can be mitigated with useEffectEvent but the refetch function may get a little tricky.
        void fetchData(gridState, additionalParamsString);

        return () => {
            // Only abort if a fetch is currently active
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
        // We are deliberately using the serialized version to control WHEN the effect runs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serializedGridState, additionalParamsString, authReady, fetchData]);

    /**
     * Expose same effect as a function
     */
    const refetch = useCallback(
        async (signal?: AbortSignal) => {
            await fetchData(gridState, additionalParamsString, signal);
        },
        // We are deliberately using the serialized version to control WHEN the function updates
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [serializedGridState, additionalParamsString, fetchData]
    );

    /**
     * Expose function to reset state to default values
     */
    const resetState = useCallback(() => {
        setData(null);
        setLoading(false);
        setError(false);
        setTotalRowCount(0);
    }, []);

    /**
     * MUI Grid Actions
     */
    const handlePaginationModelChange = (newPaginationModel: GridPaginationModel) => {
        // Reset to first page if page size changes
        setGridState((prev) => ({
            ...prev,
            paginationModel: {
                page: newPaginationModel.pageSize !== prev.paginationModel.pageSize ? 0 : newPaginationModel.page,
                pageSize: newPaginationModel.pageSize,
            },
        }));
    };

    const handleFilterModelChange = (newFilterModel: GridFilterModel) => {
        // Reset to the first page
        setGridState((prev) => ({
            ...prev,
            paginationModel: { ...prev.paginationModel, page: 0 },
            filterModel: newFilterModel,
        }));
    };

    const handleSortModelChange = (newSortModel: GridSortModel) => {
        // Reset to the first page
        setGridState((prev) => ({
            ...prev,
            paginationModel: { ...prev.paginationModel, page: 0 },
            sortModel: newSortModel,
        }));
    };

    const setPaginationModel = (model: GridPaginationModel) => {
        setGridState((prev) => ({ ...prev, paginationModel: model }));
    };

    const setSortModel = (model: GridSortModel) => {
        setGridState((prev) => ({ ...prev, sortModel: model }));
    };

    const setFilterModel = (model: GridFilterModel) => {
        setGridState((prev) => ({ ...prev, filterModel: model }));
    };

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
