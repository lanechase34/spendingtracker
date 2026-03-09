import { render } from '@test-utils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategorySelect from 'expense/CategorySelect';
import { getCachedCategories, setCachedCategories } from 'utils/categoryCache';

jest.mock('utils/categoryCache', () => ({
    getCachedCategories: jest.fn(),
    setCachedCategories: jest.fn(),
}));

const mockGetCachedCategories = getCachedCategories as jest.Mock;
const mockSetCachedCategories = setCachedCategories as jest.Mock;

/** Returns a resolved fetch mock with the given category data */
function mockSuccessResponse(data: { id: number; name: string }[]) {
    return {
        ok: true,
        json: () => Promise.resolve({ data }),
    };
}

/** Returns a delayed fetch mock that resolves after `ms` milliseconds */
function mockDelayedResponse(data: { id: number; name: string }[], ms = 5000) {
    return new Promise((resolve) => {
        setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({ data }) }), ms);
    });
}

// Simulates scroll to bottom of select dropdown
function fireScrollNearBottom(element: Element) {
    jest.spyOn(element, 'scrollTop', 'get').mockReturnValue(1000);
    jest.spyOn(element, 'clientHeight', 'get').mockReturnValue(200);
    jest.spyOn(element, 'scrollHeight', 'get').mockReturnValue(1150);
    fireEvent.scroll(element);
}

// Simulates scroll to top of select dropdown
function fireScrollNearTop(element: Element) {
    jest.spyOn(element, 'scrollTop', 'get').mockReturnValue(100);
    jest.spyOn(element, 'clientHeight', 'get').mockReturnValue(200);
    jest.spyOn(element, 'scrollHeight', 'get').mockReturnValue(1150);
    fireEvent.scroll(element);
}

const CATEGORIES = {
    fruits: { id: 1, name: 'Fruits' },
    vegetables: { id: 2, name: 'Vegetables' },
    books: { id: 3, name: 'Books' },
};

describe('CategorySelect', () => {
    let mockHandleChange: jest.Mock;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        jest.useFakeTimers();

        mockGetCachedCategories.mockReturnValue(null); // No cache by default
        mockHandleChange = jest.fn();
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Suppress expected console.error output from intentional error path tests
        jest.spyOn(console, 'error').mockImplementation(() => {
            // silence
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('Rendering', () => {
        it('Renders the input with a Category label', () => {
            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);
            expect(screen.getByLabelText('Category')).toBeInTheDocument();
        });

        it('Renders helper text when provided', () => {
            render(<CategorySelect handleCategorySelectChange={mockHandleChange} helperText="Select a category" />);
            expect(screen.getByText('Select a category')).toBeInTheDocument();
        });

        it('Renders in error state when error prop is true', () => {
            render(
                <CategorySelect
                    handleCategorySelectChange={mockHandleChange}
                    error={true}
                    helperText="Invalid category"
                />
            );
            expect(screen.getByText('Invalid category')).toBeInTheDocument();
            expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
        });

        it('Does not render in error state when error prop is false', () => {
            render(<CategorySelect handleCategorySelectChange={mockHandleChange} error={false} />);
            expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'false');
        });
    });

    describe('On open', () => {
        it('Loads options on first open when no options exist', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            expect(await screen.findByText('Fruits')).toBeInTheDocument();
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringMatching(/search=$/),
                expect.objectContaining({ method: 'GET' })
            );
        });

        it('Does not re-fetch on subsequent opens if options are already loaded', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

            // First open
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await screen.findByText('Fruits');

            // Close then re-open
            await user.keyboard('{Escape}');
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            // Should still only have made 1 fetch
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('Shows loading spinner while the initial fetch is in flight', async () => {
            mockFetch.mockImplementationOnce(() => mockDelayedResponse([CATEGORIES.fruits]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));

            expect(await screen.findByRole('progressbar')).toBeInTheDocument();

            act(() => jest.advanceTimersByTime(5000));

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
        });

        it('Uses the records prop to determine page size in the API URL', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={25} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await waitFor(() =>
                expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/records=25/), expect.anything())
            );
        });
    });

    describe('Caching', () => {
        it('Uses cached options instead of fetching when cache hit occurs', async () => {
            const cached = [{ value: 1, label: 'Cached Fruits' }];
            mockGetCachedCategories.mockReturnValue(cached);

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));

            expect(await screen.findByText('Cached Fruits')).toBeInTheDocument();
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('Does not show loading spinner when serving from cache', async () => {
            mockGetCachedCategories.mockReturnValue([{ value: 1, label: 'Cached Item' }]);

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));

            expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
        });

        it('Appends cached results when paginating', async () => {
            // First page from fetch, second page from cache
            mockGetCachedCategories
                .mockReturnValueOnce(null) // page 1 - cache miss
                .mockReturnValueOnce([{ value: 2, label: 'Vegetables' }]); // page 2 - cache hit

            mockFetch.mockResolvedValueOnce(
                mockSuccessResponse(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` })))
            );

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await screen.findByText('Cat 1');

            // Simulate scroll to bottom
            const listbox = screen.getByRole('listbox');
            fireScrollNearBottom(listbox);

            await waitFor(() => expect(screen.getByText('Vegetables')).toBeInTheDocument());
        });

        it('Saves API results to cache after a successful fetch', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await screen.findByText('Fruits');

            expect(mockSetCachedCategories).toHaveBeenCalledWith('', 1, [{ value: 1, label: 'Fruits' }]);
        });
    });

    describe('Search input', () => {
        it('Debounces fetch - does not call API until debounce delay elapses', async () => {
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.books])) // initial open
                .mockResolvedValueOnce(mockSuccessResponse([])); // search

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={1000} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.type(screen.getByRole('combobox'), 'NewCategory');

            act(() => jest.advanceTimersByTime(900));
            expect(mockFetch).toHaveBeenCalledTimes(1); // only the open fetch

            act(() => jest.advanceTimersByTime(200));

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
        });

        it('Resets the debounce timer when user keeps typing', async () => {
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.books]))
                .mockResolvedValueOnce(mockSuccessResponse([]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={1000} />);

            const user = userEvent.setup({ delay: 0, advanceTimers: jest.advanceTimersByTime });

            await user.type(screen.getByRole('combobox'), 'N');
            act(() => jest.advanceTimersByTime(500));

            await user.type(screen.getByRole('combobox'), 'ewCategory');
            act(() => jest.advanceTimersByTime(900));

            // 900ms since last keystroke - still before debounce
            expect(mockFetch).toHaveBeenCalledTimes(1);

            act(() => jest.advanceTimersByTime(200));

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
        });

        it('Trims whitespace from search input before fetching', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([])).mockResolvedValueOnce(mockSuccessResponse([]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={0} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.type(screen.getByRole('combobox'), '  Books  ');
            jest.runAllTimers();

            await waitFor(() =>
                expect(mockFetch).toHaveBeenLastCalledWith(expect.stringMatching(/search=Books$/), expect.anything())
            );
        });

        it('Sends the correct search param in the API URL', async () => {
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.books]))
                .mockResolvedValueOnce(mockSuccessResponse([]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={500} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.type(screen.getByRole('combobox'), 'NewCategory');

            act(() => jest.advanceTimersByTime(600));

            await waitFor(() =>
                expect(mockFetch).toHaveBeenLastCalledWith(
                    expect.stringMatching(/search=NewCategory/),
                    expect.objectContaining({ method: 'GET' })
                )
            );
        });

        it('Resets page to 1 and hasMore to true when new input is entered', async () => {
            // Provide 10 results on first open so hasMore becomes true, then
            // exhaust results on page 2, then type to trigger a reset
            mockFetch
                .mockResolvedValueOnce(
                    mockSuccessResponse(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` })))
                )
                .mockResolvedValueOnce(mockSuccessResponse([])) // page 2 - exhausts hasMore
                .mockResolvedValueOnce(mockSuccessResponse([])); // search fetch

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} debounceDelay={500} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await screen.findByText('Cat 1');

            // Scroll to trigger page 2 (exhausts results)
            const listbox = screen.getByRole('listbox');
            fireScrollNearBottom(listbox);
            jest.runAllTimers();
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

            // Now type - should reset page and hasMore
            await user.type(screen.getByRole('combobox'), 'Cat');
            act(() => jest.advanceTimersByTime(600));

            await waitFor(() =>
                expect(mockFetch).toHaveBeenLastCalledWith(
                    expect.stringMatching(/page=1.*search=Cat|search=Cat.*page=1/),
                    expect.anything()
                )
            );
        });
    });

    describe('Clear input', () => {
        it('Immediately reloads default options when input is cleared', async () => {
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.books])) // initial open
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits])); // after clear

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={0} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await screen.findByText('Books');

            // Select an option to get the Clear button
            await user.click(screen.getByText('Books'));
            await waitFor(() => expect(screen.getByTitle('Clear')).toBeInTheDocument());

            // Clear
            await user.click(screen.getByTitle('Clear'));
            jest.runAllTimers();

            // Reopen to see the reloaded options
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await waitFor(() => expect(screen.getByText('Fruits')).toBeInTheDocument());
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('Resets page and hasMore on clear', async () => {
            mockFetch
                .mockResolvedValueOnce(
                    mockSuccessResponse(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` })))
                ) // initial open
                .mockResolvedValueOnce(mockSuccessResponse([])) // page 2 scroll
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits])); // after clear

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} debounceDelay={500} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

            // Open and wait for options
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await screen.findByText('Cat 1');
            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

            // Scroll to page 2 to exhaust hasMore
            const listbox = screen.getByRole('listbox');
            fireScrollNearBottom(listbox);
            jest.runAllTimers();
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

            // Select an option - this gives MUI a value and renders the Clear button
            await user.click(screen.getByText('Cat 1'));
            await waitFor(() => expect(screen.getByTitle('Clear')).toBeInTheDocument());

            // Clear - should reset page and hasMore, then fetch page 1 with no search
            await user.click(screen.getByTitle('Clear'));
            jest.runAllTimers();

            await waitFor(() =>
                expect(mockFetch).toHaveBeenLastCalledWith(
                    expect.stringMatching(/page=1.*search=$|search=$.*page=1/),
                    expect.anything()
                )
            );
        });
    });

    describe('filterOptions - Add new category', () => {
        it('Shows Add option when input is >= 3 chars and no results returned', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([])).mockResolvedValueOnce(mockSuccessResponse([]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={0} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.type(screen.getByRole('combobox'), 'NewCategory');
            jest.runAllTimers();

            await waitFor(() => expect(screen.getByText('Add "NewCategory"')).toBeInTheDocument());
        });

        it('Does not show Add option when input is shorter than MIN_NEW_CATEGORY_LENGTH', async () => {
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse([])) // initial open
                .mockResolvedValueOnce(mockSuccessResponse([])) // type 'A'
                .mockResolvedValueOnce(mockSuccessResponse([])); // type 'B'

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={0} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.type(screen.getByRole('combobox'), 'AB');
            jest.runAllTimers();

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));
            expect(screen.queryByText(/Add "/)).not.toBeInTheDocument();
        });

        it('Does not show Add option when results are returned', async () => {
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits]))
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={0} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.type(screen.getByRole('combobox'), 'Frui');
            jest.runAllTimers();

            await screen.findByText('Fruits');
            expect(screen.queryByText(/Add "/)).not.toBeInTheDocument();
        });

        it('Does not show Add option while loading is in progress', async () => {
            mockFetch
                .mockResolvedValueOnce(mockSuccessResponse([])) // initial open
                .mockImplementationOnce(() => mockDelayedResponse([], 5000)); // search - delayed

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={500} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

            // Open first to consume the initial fetch
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

            // Type search term
            await user.type(screen.getByRole('combobox'), 'NewCategory');

            // Advance past debounce to trigger the delayed fetch
            act(() => jest.advanceTimersByTime(600));

            // Fetch is now in flight but response delayed - spinner should be visible
            expect(await screen.findByRole('progressbar')).toBeInTheDocument();
            expect(screen.queryByText(/Add "/)).not.toBeInTheDocument();

            // Resolve the delayed fetch
            act(() => jest.advanceTimersByTime(5000));
            await waitFor(() => expect(screen.getByText('Add "NewCategory"')).toBeInTheDocument());
        });

        it('Calls handleCategorySelectChange with raw string value when Add option is selected', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([])).mockResolvedValueOnce(mockSuccessResponse([]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={0} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.type(screen.getByRole('combobox'), 'NewCategory');
            jest.runAllTimers();

            const addOption = await screen.findByText('Add "NewCategory"');
            await user.click(addOption);

            // Match all args
            expect(mockHandleChange).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ value: 'NewCategory' }),
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe('Option selection', () => {
        it('Calls handleCategorySelectChange with numeric ID when existing option is selected', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.books]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            const option = await screen.findByText('Books');
            await user.click(option);

            expect(mockHandleChange).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ value: 3, label: 'Books' }),
                expect.anything(),
                expect.anything()
            );
        });

        it('Calls handleCategorySelectChange exactly once per selection', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.books]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await user.click(await screen.findByText('Books'));

            expect(mockHandleChange).toHaveBeenCalledTimes(1);
        });
    });

    describe('Infinite scroll pagination', () => {
        it('Loads next page when user scrolls within 100px of the bottom', async () => {
            mockFetch
                .mockResolvedValueOnce(
                    mockSuccessResponse(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` })))
                )
                .mockResolvedValueOnce(mockSuccessResponse([{ id: 11, name: 'Cat 11' }]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await screen.findByText('Cat 1');

            // Simulate scroll to bottom
            const listbox = screen.getByRole('listbox');
            fireScrollNearBottom(listbox);
            jest.runAllTimers();

            await waitFor(() => expect(screen.getByText('Cat 11')).toBeInTheDocument());
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockFetch).toHaveBeenLastCalledWith(expect.stringMatching(/page=2/), expect.anything());
        });

        it('Does not load next page when scroll is not near the bottom', async () => {
            mockFetch.mockResolvedValueOnce(
                mockSuccessResponse(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` })))
            );

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await screen.findByText('Cat 1');

            // Simulate scroll to top
            const listbox = screen.getByRole('listbox');
            fireScrollNearTop(listbox);

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('Does not load next page when hasMore is false', async () => {
            // Fewer results than page size - hasMore becomes false
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await screen.findByText('Fruits');

            // Simulate scroll to bottom
            const listbox = screen.getByRole('listbox');
            fireScrollNearBottom(listbox);

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('Does not load next page while a fetch is already in flight', async () => {
            mockFetch.mockImplementationOnce(() =>
                mockDelayedResponse(
                    Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` })),
                    100
                )
            );

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));

            // Fetch is in flight — try to scroll (listbox not yet rendered, loading is true)
            expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Resolve the fetch cleanly so no state updates leak out of the test
            act(() => {
                jest.advanceTimersByTime(100);
            });

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());

            // Confirm no second fetch was triggered
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('Appends results to existing options during pagination', async () => {
            mockFetch
                .mockResolvedValueOnce(
                    mockSuccessResponse(Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Cat ${i + 1}` })))
                )
                .mockResolvedValueOnce(mockSuccessResponse([{ id: 11, name: 'Cat 11' }]));

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} records={10} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await screen.findByText('Cat 1');

            // Simulate scroll to bottom
            const listbox = screen.getByRole('listbox');
            fireScrollNearBottom(listbox);
            jest.runAllTimers();

            await waitFor(() => {
                expect(screen.getByText('Cat 1')).toBeInTheDocument(); // original retained
                expect(screen.getByText('Cat 11')).toBeInTheDocument(); // appended
            });
        });
    });

    describe('Error handling', () => {
        it('Shows toast and clears loading when fetch returns a non-ok response', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false });

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
        });

        it('Shows toast and clears loading when fetch returns null/undefined response', async () => {
            mockFetch.mockResolvedValueOnce(null);

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
        });

        it('Shows toast and clears loading when API response fails schema validation', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [{ wrong: 'shape' }] }),
            });

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
        });

        it('Shows toast and clears loading when result.error is true', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ data: [], error: true }),
            });

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();

            await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
        });

        it('Does not show toast for AbortError - silently ignores it', async () => {
            jest.useRealTimers();

            const abortError = new DOMException('Aborted', 'AbortError');
            mockFetch
                .mockRejectedValueOnce(abortError) // aborted first request
                .mockResolvedValueOnce(mockSuccessResponse([CATEGORIES.fruits])); // second succeeds

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup();
            await user.click(screen.getByLabelText('Category'));

            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

            // Ensure no error toast rendered
            expect(screen.queryByText('Server Error. Please try again.')).not.toBeInTheDocument();

            jest.useFakeTimers();
        });
    });

    describe('Request cancellation', () => {
        it('Aborts the in-flight request when a new fetch starts', async () => {
            jest.useRealTimers();

            const abortSpy = jest.fn();
            const mockAbortController = {
                signal: {
                    aborted: false,
                    addEventListener: jest.fn(),
                    removeEventListener: jest.fn(),
                },
                abort: abortSpy,
            };
            (global as unknown as { AbortController: unknown }).AbortController = jest
                .fn()
                .mockImplementation(() => mockAbortController);

            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }), 50);
                    })
            );

            render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup();
            await user.click(screen.getByLabelText('Category'));
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

            // Typing triggers a new fetch, which should abort the previous one
            await user.type(screen.getByRole('combobox'), 'NewBook');
            await waitFor(() => expect(abortSpy).toHaveBeenCalled());
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

            jest.useFakeTimers();
        });

        it('Aborts in-flight request on component unmount', async () => {
            jest.useRealTimers();

            const abortSpy = jest.fn();
            (global as unknown as { AbortController: unknown }).AbortController = jest.fn().mockImplementation(() => ({
                signal: { aborted: false, addEventListener: jest.fn(), removeEventListener: jest.fn() },
                abort: abortSpy,
            }));

            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(() => resolve({ ok: true, json: () => Promise.resolve({ data: [] }) }), 1000)
                    )
            );

            const { unmount } = render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

            const user = userEvent.setup();
            await user.click(screen.getByLabelText('Category'));
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

            unmount();

            expect(abortSpy).toHaveBeenCalled();

            jest.useFakeTimers();
        });
    });

    describe('Debounce cleanup', () => {
        it('Clears pending debounced calls on unmount', async () => {
            mockFetch.mockResolvedValueOnce(mockSuccessResponse([])); // only open fetch should fire

            const { unmount } = render(
                <CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={1000} />
            );

            const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

            // Open to trigger initial fetch
            await user.click(screen.getByLabelText('Category'));
            jest.runAllTimers();
            await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

            // Use fireEvent to queue the debounced fetch without advancing timers
            const input = screen.getByRole('combobox');
            fireEvent.change(input, { target: { value: 'Pending' } });

            // Unmount before debounce fires
            unmount();

            // Advance past debounce — should not fire
            act(() => jest.advanceTimersByTime(1500));

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });
    });
});
