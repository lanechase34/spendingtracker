import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import { Typography } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import { QuickFilter, QuickFilterClear, QuickFilterControl, Toolbar } from '@mui/x-data-grid';

interface SearchToolbarProps {
    title?: string;
}

/**
 * Custom toolbar for a DataGrid component that adds a search box function
 * @title Optional top left title to show
 */
export default function SearchToolbar({ title }: SearchToolbarProps) {
    return (
        <Toolbar>
            <Typography sx={{ mr: 'auto', ml: 1, fontSize: '1.25rem' }}>{title}</Typography>
            <QuickFilter expanded debounceMs={500}>
                <QuickFilterControl
                    render={({ ref, ...other }) => (
                        <TextField
                            {...other}
                            sx={{ width: 260 }}
                            inputRef={ref}
                            aria-label="Search"
                            placeholder="Search..."
                            size="small"
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: other.value ? (
                                        <InputAdornment position="end">
                                            <QuickFilterClear
                                                edge="end"
                                                size="small"
                                                aria-label="Clear search"
                                                material={{ sx: { marginRight: -0.75 } }}
                                            >
                                                <CancelIcon fontSize="small" />
                                            </QuickFilterClear>
                                        </InputAdornment>
                                    ) : null,
                                    ...other.slotProps?.input,
                                },
                                ...other.slotProps,
                            }}
                        />
                    )}
                />
            </QuickFilter>
        </Toolbar>
    );
}
