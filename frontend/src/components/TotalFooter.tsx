import { GridFooterContainer, GridPagination } from '@mui/x-data-grid';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import useCurrencyFormatter from 'hooks/useCurrencyFormatter';

interface TotalFooterProps {
    totalSum: number | null;
    filteredSum: number | null;
}

export default function TotalFooter({ totalSum, filteredSum }: TotalFooterProps) {
    const { formatCurrency } = useCurrencyFormatter({});

    const hasTotal = totalSum !== null;
    const hasFiltered = filteredSum !== null;
    // Show filtered when total != filtered
    const showFiltered = hasTotal && hasFiltered && totalSum !== filteredSum;

    const formattedTotal = hasTotal ? formatCurrency(totalSum) : '';
    const formattedFiltered = hasFiltered ? formatCurrency(filteredSum) : '';

    return (
        <GridFooterContainer data-testid="total-footer">
            <Box sx={{ pl: 2 }}>
                <Typography variant="body2">Total: {formattedTotal}</Typography>

                {showFiltered && <Typography variant="body2">Filtered: {formattedFiltered}</Typography>}
            </Box>

            <Box sx={{ ml: 'auto' }}>
                <GridPagination />
            </Box>
        </GridFooterContainer>
    );
}
