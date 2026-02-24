import type { FilterOptionsState } from '@mui/material';
import type { AutocompleteInputChangeReason } from '@mui/material/Autocomplete';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import type { PopperProps } from '@mui/material/Popper';
import Popper from '@mui/material/Popper';
import TextField from '@mui/material/TextField';
import { debounce } from '@mui/material/utils';
import useAuthFetch from 'hooks/useAuthFetch';
import useToastContext from 'hooks/useToastContext';
import type { SyntheticEvent } from 'react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { APIResponseType } from 'types/APIResponse.type';
import type { SelectOptionType } from 'types/SelectOption.type';
import { getCachedCategories, setCachedCategories } from 'utils/categoryCache';
import { z } from 'zod';

function DownwardPopper(props: PopperProps) {
    return <Popper {...props} placement="bottom-start" modifiers={[{ name: 'flip', enabled: false }]} />;
}

interface CategorySelectProps {
    handleCategorySelectChange: (event: SyntheticEvent<Element, Event>, option: SelectOptionType | null) => void;
    error?: boolean;
    helperText?: string | null;
    records?: number;
    debounceDelay?: number;
}

interface Category {
    id: number;
    name: string;
}

const CategorySchema = z.object({
    id: z.number(),
    name: z.string(),
});

const CategoryAPISchema = z.object({
    data: z.array(CategorySchema),
    error: z.optional(z.boolean()),
});

/**
 * Category select dropdown
 */
export default function CategorySelect({
    handleCategorySelectChange,
    error,
    helperText,
    records = 10,
    debounceDelay = 750,
}: CategorySelectProps) {
    const [open, setOpen] = useState<boolean>(false);
    const [options, setOptions] = useState<SelectOptionType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [searchValue, setSearchValue] = useState<string>('');
    const [currPage, setCurrPage] = useState<number>(1);
    const [hasMore, setHasMore] = useState<boolean>(true);

    const authFetch = useAuthFetch();
    const { showToast } = useToastContext();

    // Track the current abort controller
    const abortControllerRef = useRef<AbortController | null>(null);

    const loadOptions = useCallback(
        async (search: string, page: number, append: boolean) => {
            // Use cached options if exists
            const cached = getCachedCategories(search, page);
            if (cached) {
                setOptions(append ? (prev) => [...prev, ...cached] : cached);
                setHasMore(cached.length > 0);
                return;
            }

            // No cache, begin api fetch
            setLoading(true);

            // Cancel any ongoing request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller for this request
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            try {
                const response = await authFetch({
                    url: `/spendingtracker/api/v1/categories?page=${page}&records=${records}&search=${search}`,
                    method: 'GET',
                    signal: abortController.signal,
                });

                if (!response) return;
                if (!response.ok) throw new Error('Invalid network response');

                // Validate the response data
                const valid = z.safeParse(CategoryAPISchema, (await response.json()) as APIResponseType<Category>);
                if (!valid.success) throw new Error('Invalid response');

                const result = valid.data;
                if (result.error) throw new Error('Bad Request');

                const formatted = result.data.map((item: Category) => ({
                    value: item.id,
                    label: item.name,
                }));

                // Save to cache
                setCachedCategories(search, page, formatted);

                setOptions(append ? (prev) => [...prev, ...formatted] : formatted);
                setHasMore(result.data.length > 0);
                setLoading(false);
            } catch (err: unknown) {
                const errorInfo = err as { name?: string; message?: string };
                if (errorInfo.name !== 'AbortError') {
                    console.error('Failed to load categories:', err);
                    showToast('Server Error. Please try again.', 'error');
                    setLoading(false);
                }
            }
        },
        [records, authFetch, showToast]
    );

    const debouncedFetch = useMemo(
        () =>
            debounce((input: string) => {
                void loadOptions(input, 1, false);
            }, debounceDelay),
        [loadOptions, debounceDelay]
    );

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    // Cancel pending debounced calls on unmount
    useEffect(() => {
        return () => {
            debouncedFetch.clear();
        };
    }, [debouncedFetch]);

    const handleOpen = () => {
        setOpen(true);
        // Load options on first open
        if (options.length === 0) {
            void loadOptions('', 1, false);
        }
    };

    const handleClose = () => {
        setOpen(false);
    };

    const handleScroll = useCallback(
        (event: SyntheticEvent) => {
            const listboxNode = event.currentTarget;
            const scrollPosition = listboxNode.scrollTop + listboxNode.clientHeight;
            const scrollHeight = listboxNode.scrollHeight;
            // Load more when user scrolls to within 50px of the bottom
            if (scrollHeight - scrollPosition <= 100 && hasMore && !loading) {
                const nextPage = currPage + 1;
                setCurrPage(nextPage);
                void loadOptions(searchValue, nextPage, true);
            }
        },
        [currPage, searchValue, loadOptions, loading, hasMore]
    );

    return (
        <FormControl fullWidth>
            <Autocomplete
                open={open}
                onOpen={handleOpen}
                onClose={handleClose}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                getOptionLabel={(option) => option.label}
                options={options}
                loading={loading}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Category"
                        slotProps={{
                            input: {
                                ...params.InputProps,
                                endAdornment: (
                                    <Fragment>
                                        {loading ? <CircularProgress color="inherit" size={20} /> : null}
                                        {params.InputProps.endAdornment}
                                    </Fragment>
                                ),
                            },
                        }}
                        variant="outlined"
                        error={error}
                        helperText={helperText}
                    />
                )}
                slotProps={{
                    listbox: {
                        style: {
                            maxHeight: 200,
                            overflowY: 'auto',
                        },
                        onScroll: handleScroll,
                    },
                }}
                slots={{
                    popper: DownwardPopper,
                }}
                filterOptions={(options: SelectOptionType[], params: FilterOptionsState<SelectOptionType>) => {
                    // Category must be min 3 chars, and no option(s) returned from server
                    // ask user to create this category
                    if (!loading && params.inputValue.length > 3 && !options.length) {
                        return [{ value: params.inputValue, label: `Add "${params.inputValue}"` }];
                    }
                    return options;
                }}
                onInputChange={(
                    _event: SyntheticEvent<Element, Event>,
                    newValue: string,
                    reason: AutocompleteInputChangeReason
                ) => {
                    const searchVal = reason === 'clear' ? '' : newValue;
                    if ((reason === 'input' || reason === 'clear') && searchVal.length >= 3) {
                        setCurrPage(1);
                        setSearchValue(searchVal);
                        debouncedFetch(newValue);
                    }
                }}
                onChange={handleCategorySelectChange}
            />
        </FormControl>
    );
}
