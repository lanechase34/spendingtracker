import type { GridFilterModel, GridPaginationModel,GridSortModel } from '@mui/x-data-grid';

export interface UsePaginatedFetchReturn<T> {
    data: T | null;
    loading: boolean;
    error: boolean;
    paginationModel: GridPaginationModel; // Page, Page Size
    setPaginationModel: (model: GridPaginationModel) => void;
    sortModel: GridSortModel; // Field, Sort Direction
    setSortModel: (model: GridSortModel) => void;
    filterModel: GridFilterModel; // Array of filter options
    setFilterModel: (model: GridFilterModel) => void;
    totalRowCount: number;
    refetch: (signal?: AbortSignal) => Promise<void>;
    resetState: () => void;
    handlePaginationModelChange: (newModel: GridPaginationModel) => void;
    handleSortModelChange: (newModel: GridSortModel) => void;
    handleFilterModelChange: (newModel: GridFilterModel) => void;
}
