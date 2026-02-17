import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';

/**
 * Adds loading circle to end adornment (for input)
 */
export default function EndAdornmentLoading({ loading }: { loading: boolean }) {
    return loading ? (
        <InputAdornment position="end">
            <CircularProgress size={20} />
        </InputAdornment>
    ) : null;
}
