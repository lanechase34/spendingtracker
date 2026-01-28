export interface PaginationAPIType {
    page: number;
    offset: number;
    totalRecords: number;
    filteredRecords?: number;
    totalPages: number;
}
