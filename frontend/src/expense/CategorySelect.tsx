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

// Minimum character length required for a user to add a new category
const MIN_NEW_CATEGORY_LENGTH = 3;

/**
 * Overrides MUI Autocomplete's default popper behaviour to always
 * open downward, preventing the dropdown from flipping above the input.
 */
function DownwardPopper(props: PopperProps) {
    return <Popper {...props} placement="bottom-start" modifiers={[{ name: 'flip', enabled: false }]} />;
}

// Category record
interface Category {
    id: number;
    name: string;
}

// Zod schema for validating a single category record
const CategorySchema = z.object({
    id: z.number(),
    name: z.string(),
});

// Zod schema for validating the full category list API response
const CategoryAPISchema = z.object({
    data: z.array(CategorySchema),
    error: z.optional(z.boolean()),
});

interface CategorySelectProps {
    /**
     * Callback fired when the user selects an existing category or chooses to add a new one.
     * - Existing category: `option.value` is the numeric category ID.
     * - New category: `option.value` is the raw input string (no ID yet).
     */
    handleCategorySelectChange: (event: SyntheticEvent<Element, Event>, option: SelectOptionType | null) => void;
    /** Whether the input should display in an error state. */
    error?: boolean;
    /** Helper text displayed below the input, typically for validation messages. */
    helperText?: string | null;
    /** Number of records to fetch per page. Defaults to 10. */
    records?: number;
    /** Debounce delay in milliseconds for search input. Defaults to 500. */
    debounceDelay?: number;
}

/**
 * Async category select dropdown with server-side search, infinite scroll pagination,
 * response caching, and the ability to add new categories inline.
 *
 * Behaviour
 * - On open: loads the first page of all categories with no search filter.
 * - On input: debounces search requests to avoid excessive API calls.
 * - On scroll: loads additional pages when the user nears the bottom of the list.
 * - On clear: immediately reloads the default unfiltered category list.
 * - If no results are found and input meets {MIN_NEW_CATEGORY_LENGTH},
 *   an "Add" option is surfaced. Selecting it passes the raw string as `value`
 *   to {CategorySelectProps.handleCategorySelectChange} for the parent to handle creation.
 *
 * Caching
 * - Results are cached per search+page combination via {getCachedCategories}.
 * - Cached results bypass the loading state and API entirely.
 */
export default function CategorySelect({
    handleCategorySelectChange,
    error,
    helperText,
    records = 10,
    debounceDelay = 500,
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

    /**
     * Fetches a page of category options from the API, optionally appending to existing options.
     * Checks the cache first - if a cached result exists for this search+page, it is used directly.
     * Cancels any in-flight request before starting a new one.
     *
     * @param search The search string to filter categories by.
     * @param page The page number to fetch.
     * @param append If true, appends results to existing options (pagination).
     *               If false, replaces options entirely (new search).
     */
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

                if (!response) throw new Error('No response returned.');
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
                setHasMore(result.data.length >= records);
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

    /**
     * Debounced wrapper around search input
     * Always starts at page 1
     */
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
        // Intentionally loads all options on open before the user starts typing.
        if (options.length === 0) {
            void loadOptions('', 1, false);
        }
    };

    const handleClose = () => {
        setOpen(false);
    };

    /**
     * Handles infinite scroll pagination within the listbox.
     * Triggers the next page load when the user scrolls within 100px of the bottom,
     * provided more results are available and no request is currently in flight.
     */
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
                    if (!loading && params.inputValue.length >= MIN_NEW_CATEGORY_LENGTH && !options.length) {
                        return [{ value: params.inputValue, label: `Add "${params.inputValue}"` }];
                    }
                    return options;
                }}
                onInputChange={(
                    _event: SyntheticEvent<Element, Event>,
                    newValue: string,
                    reason: AutocompleteInputChangeReason
                ) => {
                    if (reason === 'clear') {
                        setCurrPage(1);
                        setHasMore(true);
                        setSearchValue('');
                        void loadOptions('', 1, false);
                    }

                    if (reason === 'input') {
                        const trimmedInput = newValue.trim();
                        setCurrPage(1);
                        setHasMore(true);
                        setSearchValue(trimmedInput);
                        debouncedFetch(trimmedInput);
                    }
                }}
                onChange={handleCategorySelectChange}
            />
        </FormControl>
    );
}
