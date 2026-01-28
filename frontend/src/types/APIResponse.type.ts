import type { PaginationAPIType } from './PaginationAPI.type';

export interface APIResponseType<T> {
    data: T;
    pagination?: PaginationAPIType;
    error?: boolean;
    messages?: string[];
}
