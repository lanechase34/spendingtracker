import { render } from '@test-utils';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategorySelect from 'expense/CategorySelect';

// Mock the category cache
jest.mock('utils/categoryCache', () => ({
    getCachedCategories: jest.fn(),
    setCachedCategories: jest.fn(),
}));

describe('CategorySelect', () => {
    let mockHandleChange: jest.Mock;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        jest.useFakeTimers();

        mockHandleChange = jest.fn();
        mockFetch = jest.fn();
        global.fetch = mockFetch;
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('Renders input field with label', () => {
        render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

        expect(screen.getByLabelText('Category')).toBeInTheDocument();
    });

    it('Shows loading spinner while fetching', async () => {
        // Delay the fetch so we can observe the loading state
        mockFetch.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            json: () => Promise.resolve({ data: [{ id: 1, name: 'Category A' }] }),
                        });
                    }, 5000); // Simulate a large delay
                })
        );

        render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

        // Open autocomplete — should trigger loadOptions
        // skips waiting for promise to resolve - let's us test behavior while loading
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await user.click(screen.getByLabelText('Category'));

        // Loading spinner appears during fetch
        expect(await screen.findByRole('progressbar')).toBeInTheDocument();

        // Fast-forward the timeout so fetch resolves
        act(() => {
            jest.advanceTimersByTime(5000);
        });

        await waitFor(() => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument());
    });

    it('Displays options returned from the API', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: [
                    { id: 1, name: 'Fruits' },
                    { id: 2, name: 'Vegetables' },
                ],
            }),
        });

        render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

        // Open autocomplete - force the fake timer to advance and run the cli
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await user.click(screen.getByLabelText('Category'));
        jest.runAllTimers();

        expect(await screen.findByText('Fruits')).toBeInTheDocument();
        expect(screen.getByText('Vegetables')).toBeInTheDocument();
    });

    it('Calls handleCategorySelectChange when selecting an option', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: () => ({
                data: [{ id: 1, name: 'Books' }],
            }),
        });

        render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await user.click(screen.getByLabelText('Category'));
        jest.runAllTimers();

        const option = await screen.findByText('Books');
        await user.click(option);
        jest.runAllTimers();

        expect(mockHandleChange).toHaveBeenCalledTimes(1);
    });

    it('Shows helper text and error state when provided', () => {
        render(
            <CategorySelect handleCategorySelectChange={mockHandleChange} error={true} helperText="Invalid category" />
        );

        expect(screen.getByText('Invalid category')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('Adds "Add <term>" option when no results and user types long input', async () => {
        // First mock for first open, second for when user starts typing
        mockFetch
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                json: () =>
                                    Promise.resolve({
                                        data: [
                                            { id: 1, name: 'Fruits' },
                                            { id: 2, name: 'Vegetables' },
                                        ],
                                    }),
                            });
                        }, 5000); // Simulate a large delay
                    })
            )
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => {
                            resolve({
                                ok: true,
                                // mock no results returned from search
                                json: () => Promise.resolve({ data: [] }),
                            });
                        }, 5000); // Simulate a large delay
                    })
            );

        render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={1000} />);

        const input = screen.getByRole('combobox');

        // User types more than 3 characters
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        await user.type(input, 'NewCategory');

        // Loading spinner appears during fetch
        expect(await screen.findByRole('progressbar')).toBeInTheDocument();

        // Fast-forward the timeout so fetch resolves
        act(() => {
            jest.advanceTimersByTime(5100);
        });

        await waitFor(() => {
            expect(screen.getByText('Add "NewCategory"')).toBeInTheDocument();
        });

        // First fetch triggered by open; second triggered by typing input
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Only the second mockFetch should have the search param
        expect(mockFetch).toHaveBeenNthCalledWith(
            1,
            expect.stringMatching(/search=$/),
            expect.objectContaining({ method: 'GET' })
        );

        expect(mockFetch).toHaveBeenNthCalledWith(
            2,
            expect.stringMatching(/search=NewCategory/),
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('Fetch waits until user stops typing for debounce delay ms', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    data: [{ id: 1, name: 'Books' }],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    data: [],
                }),
            });

        // High debounce delay
        render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={1000} />);

        const input = screen.getByRole('combobox');
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

        // Simulate user typing "NewCategory"
        await user.type(input, 'NewCategory');

        act(() => {
            jest.advanceTimersByTime(200);
        });

        // Fetch should not have triggered twice (first happens because of onLoad)
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Fast-forward time less than debounce delay — still nothing
        act(() => {
            jest.advanceTimersByTime(700);
        });
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Advance past the debounce delay threshold
        act(() => {
            jest.advanceTimersByTime(100);
        });

        await waitFor(() => {
            expect(screen.getByText('Add "NewCategory"')).toBeInTheDocument();
        });

        // Fetch will finally have triggered
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // it('Load more options if the user scrolls within 100px of bottom', async () => {});

    it('Resets debounce delay when user keeps typing', async () => {
        mockFetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    data: [{ id: 1, name: 'Books' }],
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => ({
                    data: [],
                }),
            });

        // High debounce delay
        render(<CategorySelect handleCategorySelectChange={mockHandleChange} debounceDelay={1000} />);

        const input = screen.getByRole('combobox');
        const user = userEvent.setup({
            delay: 0,
            advanceTimers: jest.advanceTimersByTime,
        });

        // Simulate user typing "NewCategory" with small pauses between keystrokes
        // User starts typing "N"
        await user.type(input, 'N');
        expect(mockFetch).toHaveBeenCalledTimes(1); // first fetch from onLoad

        // Advance time halfway (still before debounce threshold)
        act(() => {
            jest.advanceTimersByTime(500);
        });

        // User types another character before debounce finishes
        await user.type(input, 'ewCategory');

        // Move time forward a bit — debounce should have reset
        act(() => {
            jest.advanceTimersByTime(900);
        });

        // Still before 1000ms since last keystroke - no fetch for search yet
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Advance past the debounce delay
        act(() => {
            jest.advanceTimersByTime(300);
        });

        await waitFor(() => {
            expect(screen.getByText('Add "NewCategory"')).toBeInTheDocument();
        });

        // Now the debounced search fetch should have fired
        expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('Aborts ongoing request when a new fetch starts', async () => {
        jest.useRealTimers(); // Use real timer

        // Mock abort controller
        const abortSpy = jest.fn();
        const abortControllerSetup = {
            signal: {
                aborted: false,
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
            },
            abort: abortSpy,
        };
        const abortControllerMock = jest.fn().mockImplementation(() => abortControllerSetup);
        (global as unknown as { AbortController: typeof AbortController }).AbortController = abortControllerMock;

        mockFetch.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            ok: true,
                            json: () => Promise.resolve({ data: [] }),
                        });
                    }, 50); // Short delay
                })
        );

        render(<CategorySelect handleCategorySelectChange={mockHandleChange} />);

        const input = screen.getByLabelText('Category');
        const user = userEvent.setup();

        // First open triggers fetch
        await user.click(input);
        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

        // Typing triggers abort + new fetch
        await user.type(input, 'NewBook');
        await waitFor(() => expect(abortSpy).toHaveBeenCalled());
        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
        await waitFor(() => expect(screen.getByText('Add "NewBook"')).toBeInTheDocument());

        jest.useFakeTimers();
    });
});
