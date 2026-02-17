import Pagination from '@mui/material/Pagination';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { gridPageCountSelector, useGridApiContext, useGridSelector } from '@mui/x-data-grid';
import type { ChangeEvent } from 'react';

interface CustomPaginationProps {
    page: number;
    onPageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
    className?: string;
}

/**
 * Custom pagination style and buttons for MUI data grid
 */
export default function CustomPagination({ page, onPageChange, className }: CustomPaginationProps) {
    const apiRef = useGridApiContext();
    const pageCount = useGridSelector(apiRef, gridPageCountSelector);

    const theme = useTheme();
    const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg'));

    const siblingCount = isLargeScreen ? 1 : 0;
    const boundaryCount = isLargeScreen ? 1 : 0;

    return (
        <Pagination
            color="primary"
            className={className}
            count={pageCount}
            page={page + 1}
            siblingCount={siblingCount}
            boundaryCount={boundaryCount}
            onChange={(_event: ChangeEvent<unknown>, newPage: number) => {
                onPageChange(null, newPage - 1);
            }}
        />
    );
}
