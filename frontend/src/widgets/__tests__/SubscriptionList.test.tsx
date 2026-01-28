import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { render, createSubscriptionContext } from '@test-utils';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
Object.assign(global, { TextDecoder, TextEncoder });
import SubscriptionList from 'widgets/SubscriptionList';

describe('Subscription List Component', () => {
    const mockToggle = jest.fn();
    const mockDelete = jest.fn();
    const mockHandleIntervalChange = jest.fn();

    const mockSubscriptions = [
        {
            id: 1,
            nextChargeDate: '2025-12-01',
            amount: 9.99,
            description: 'Netflix',
            category: 'Entertainment',
            interval: 'M' as const,
            active: 1,
        },
        {
            id: 2,
            nextChargeDate: '2026-01-15',
            amount: 99.99,
            description: 'Adobe CC',
            category: 'Software',
            interval: 'Y' as const,
            active: 0,
        },
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Renders subscription rows', async () => {
        const subscriptionContextValue = createSubscriptionContext({
            subscriptions: [...mockSubscriptions],
            filteredSum: 109.98,
            totalSum: 109.98,
            totalRowCount: 2,
        });
        render(<SubscriptionList />, { subscriptionContextValue });

        expect(await screen.findByText('Subscription List')).toBeInTheDocument();
        expect(screen.getByText('Netflix')).toBeInTheDocument();
        expect(screen.getByText('Adobe CC')).toBeInTheDocument();
    });

    it('Renders error card when error occurs', () => {
        const subscriptionContextValue = createSubscriptionContext({
            subscriptions: [],
            error: true,
        });
        render(<SubscriptionList />, { subscriptionContextValue });

        expect(screen.getByTestId('error-card')).toBeInTheDocument();
    });

    it('Displays formatted date for active and "---" for inactive subscription next charge date', () => {
        const subscriptionContextValue = createSubscriptionContext({
            subscriptions: [...mockSubscriptions],
            filteredSum: 109.98,
            totalSum: 109.98,
            totalRowCount: 2,
        });
        render(<SubscriptionList />, { subscriptionContextValue });

        const rows = screen.getAllByRole('row');

        // Inactive rows become '---'
        const inactiveRow = rows.find((row) => row.textContent?.includes('Adobe CC'));
        expect(inactiveRow).toHaveTextContent('---');

        // Active rows become MM/DD/YYYY
        const activeRow = rows.find((row) => row.textContent?.includes('Netflix'));
        expect(activeRow).toHaveTextContent(/12\/01\/2025/);
    });

    it('Displays formatted amounts', async () => {
        const subscriptionContextValue = createSubscriptionContext({
            subscriptions: [...mockSubscriptions],
            filteredSum: 109.98,
            totalSum: 109.98,
            totalRowCount: 2,
        });
        render(<SubscriptionList />, { subscriptionContextValue });

        expect(await screen.findByText('Netflix')).toBeInTheDocument();
        expect(screen.getByText('$9.99')).toBeInTheDocument();
        expect(screen.getByText('$99.99')).toBeInTheDocument();
    });

    it('Displays total sum in footer', () => {
        const subscriptionContextValue = createSubscriptionContext({
            subscriptions: [...mockSubscriptions],
            filteredSum: 109.98,
            totalSum: 109.98, // total == filtered - only total will show
            totalRowCount: 2,
        });
        render(<SubscriptionList />, { subscriptionContextValue });

        const footer = screen.getByTestId('total-footer');
        expect(footer).toHaveTextContent('Total: $109.98');
        expect(footer).not.toHaveTextContent('Filtered: $109.98');
    });

    it('Displays total and filtered sum in footer', () => {
        const subscriptionContextValue = createSubscriptionContext({
            subscriptions: [...mockSubscriptions],
            filteredSum: 10.98,
            totalSum: 109.98, // total != filtered - both will show
            totalRowCount: 2,
        });
        render(<SubscriptionList />, { subscriptionContextValue });

        const footer = screen.getByTestId('total-footer');
        expect(footer).toHaveTextContent('Total: $109.98');
        expect(footer).toHaveTextContent('Filtered: $10.98');
    });

    describe('Loading and Empty States', () => {
        it('Shows loading state', () => {
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [],
                loading: true,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const rows = screen.getAllByRole('row');
            expect(rows.length).toBe(1); // only header row when loading
        });

        it('Shows "No Subscriptions Found" when no data', () => {
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [],
                loading: false,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            expect(screen.getByText('No Subscriptions Found')).toBeInTheDocument();
        });
    });

    describe('Toggle Subscription', () => {
        it('Toggles active subscription to paused', async () => {
            const user = userEvent.setup();
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                toggleSubscription: mockToggle,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            /**
             * Select the active row's pause button
             */
            const row1 = screen.getByText('Netflix').closest('[role="row"]')!;
            const pauseButton = within(row1 as HTMLElement).getByLabelText('Pause subscription');
            await user.click(pauseButton);

            await waitFor(() => {
                /**
                 * Toggle subscription was called with active row information
                 **/
                expect(mockToggle).toHaveBeenCalledWith({
                    active: 1,
                    amount: 9.99,
                    category: 'Entertainment',
                    description: 'Netflix',
                    id: 1,
                    interval: 'M',
                    nextChargeDate: '2025-12-01',
                });
            });
        });

        it('Toggles paused subscription to active', async () => {
            mockToggle.mockImplementation(() => new Promise((res) => setTimeout(res, 400)));

            const user = userEvent.setup();
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                toggleSubscription: mockToggle,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            /**
             * Select the inactive row's resume button
             */
            const row1 = screen.getByText('Adobe CC').closest('[role="row"]')!;
            const resumeButton = within(row1 as HTMLElement).getByLabelText('Resume subscription');
            await user.click(resumeButton);

            // Spinner should appear on button
            expect(await screen.findByRole('progressbar')).toBeInTheDocument();

            await waitFor(() => {
                /**
                 * Toggle subscription was called with inactive row information
                 **/
                expect(mockToggle).toHaveBeenCalledWith({
                    id: 2,
                    nextChargeDate: '2026-01-15',
                    amount: 99.99,
                    description: 'Adobe CC',
                    category: 'Software',
                    interval: 'Y',
                    active: 0,
                });
            });
        });

        it('Prevents multiple simultaneous toggle actions (race condition)', () => {
            mockToggle.mockImplementation(() => new Promise((res) => setTimeout(res, 200)));

            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                toggleSubscription: mockToggle,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const row1 = screen.getByText('Netflix').closest('[role="row"]')!;
            const pauseBtn = within(row1 as HTMLElement).getByLabelText('Pause subscription');

            const row2 = screen.getByText('Adobe CC').closest('[role="row"]')!;
            const resumeBtn = within(row2 as HTMLElement).getByLabelText('Resume subscription');

            // Trigger buttons rapidly
            fireEvent.click(pauseBtn);
            fireEvent.click(resumeBtn);
            fireEvent.click(resumeBtn);
            fireEvent.click(pauseBtn);
            fireEvent.click(pauseBtn);
            fireEvent.click(resumeBtn);

            // Only triggered once - No double triggers
            expect(mockToggle).toHaveBeenCalledTimes(1);
        });

        it('Disables all action buttons during toggle', async () => {
            const user = userEvent.setup();

            mockToggle.mockImplementation(() => new Promise((res) => setTimeout(res, 400)));

            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                toggleSubscription: mockToggle,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const pauseButton = screen.getAllByLabelText('Pause subscription')[0];
            await user.click(pauseButton);

            // Check all buttons are disabled
            const allButtons = screen.getAllByRole('button');
            const actionButtons = allButtons.filter(
                (btn) =>
                    btn.getAttribute('aria-label')?.includes('subscription') ??
                    btn.getAttribute('aria-label')?.includes('delete')
            );

            actionButtons.forEach((button) => {
                expect(button).toBeDisabled();
            });

            await waitFor(() => expect(mockToggle).toHaveBeenCalledTimes(1));
        });
    });

    describe('Delete Subscription', () => {
        it('Opens confirmation dialog when delete is clicked', async () => {
            const user = userEvent.setup();
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const deleteButtons = screen.getAllByLabelText(/delete/i);
            await user.click(deleteButtons[0]);
            expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();
        });

        it('Deletes subscription when confirmed and refetches the page when finishes', async () => {
            const user = userEvent.setup();
            mockDelete.mockImplementation(() => new Promise((res) => setTimeout(res, 200)));
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                deleteSubscription: mockDelete,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            // Click first delete
            const deleteButtons = screen.getAllByLabelText(/delete/i);
            await user.click(deleteButtons[0]);
            const confirmButton = screen.getByRole('button', { name: /confirm/i });

            await user.click(confirmButton);
            // Delete function will have been called with the subscriptionid
            await waitFor(() => {
                expect(mockDelete).toHaveBeenCalledWith(1);
            });
        });

        it('Closes dialog when cancel is clicked', async () => {
            const user = userEvent.setup();
            mockDelete.mockImplementation(() => new Promise((res) => setTimeout(res, 200)));
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                deleteSubscription: mockDelete,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const deleteButtons = screen.getAllByLabelText(/delete/i);
            await user.click(deleteButtons[0]);
            expect(screen.getByText(/permanently delete/i)).toBeInTheDocument();

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            await user.click(cancelButton);

            // Dialog no longer shows
            await waitFor(() => {
                expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument();
            });

            // Delete did not trigger
            expect(mockDelete).toHaveBeenCalledTimes(0);
        });

        it('Prevents multiple delete confirmations (race condition)', async () => {
            // Ignore the no pointer for the button option
            const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

            mockDelete.mockImplementation(() => new Promise((res) => setTimeout(res, 200)));
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                deleteSubscription: mockDelete,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const deleteButtons = screen.getAllByLabelText(/delete/i);
            await user.click(deleteButtons[0]);
            const confirmButton = screen.getByRole('button', { name: /confirm/i });

            // Click confirm multiple times rapidly
            await user.click(confirmButton);
            await user.click(confirmButton);
            await user.click(confirmButton);

            // Wait for delete to finish and dialog closes
            await waitFor(() => {
                expect(screen.queryByText(/permanently delete/i)).not.toBeInTheDocument();
            });

            // Should only call delete once
            expect(mockDelete).toHaveBeenCalledTimes(1);
        });
    });

    describe('Interval Filtering', () => {
        it('Renders interval dropdown with correct options', async () => {
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const intervalSelect = screen.getByLabelText('Interval');
            await userEvent.click(intervalSelect);
            expect(screen.getByText('All')).toBeInTheDocument();
            expect(screen.getByTestId('yearly')).toBeInTheDocument();
            expect(screen.getByTestId('monthly')).toBeInTheDocument();
        });

        it('Updates interval filter when dropdown changes', async () => {
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                filteredSum: 109.98,
                totalSum: 109.98,
                totalRowCount: 2,
                handleIntervalChange: mockHandleIntervalChange,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const user = userEvent.setup();

            const intervalSelect = screen.getByLabelText('Interval');

            await user.click(intervalSelect);
            const yearlyOption = screen.getByTestId('yearly'); // Interval dropdown yearly option
            await user.click(yearlyOption);
            expect(mockHandleIntervalChange).toHaveBeenCalledTimes(1);

            await user.click(intervalSelect);
            const monthlyOption = screen.getByTestId('monthly'); // Interval dropdown monthly option
            await user.click(monthlyOption);
            expect(mockHandleIntervalChange).toHaveBeenCalledTimes(2);
        });
    });

    describe('Data grid actions', () => {
        it('Calls pagination handler when changing page', () => {
            const mockHandlePaginationChange = jest.fn();
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                totalRowCount: 25, // mock multiple pages
                paginationModel: { page: 0, pageSize: 10 },
                handlePaginationModelChange: mockHandlePaginationChange,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const nextBtn = screen.getByLabelText('Go to next page');
            fireEvent.click(nextBtn);
            expect(mockHandlePaginationChange).toHaveBeenCalled();
        });

        it('Calls sort handler when changing sort dir', () => {
            const mockHandleSortModelChange = jest.fn();
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                totalRowCount: 2,
                handleSortModelChange: mockHandleSortModelChange,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const header = screen.getByText('Amount');
            fireEvent.click(header);

            expect(mockHandleSortModelChange).toHaveBeenCalled();
        });

        it('Calls filter handler (quick filter)', async () => {
            const mockHandleFilterChange = jest.fn();
            const subscriptionContextValue = createSubscriptionContext({
                subscriptions: [...mockSubscriptions],
                totalRowCount: 2,
                handleFilterModelChange: mockHandleFilterChange,
            });
            render(<SubscriptionList />, { subscriptionContextValue });

            const searchInput = screen.getByPlaceholderText('Search...');
            fireEvent.change(searchInput, { target: { value: 'net' } });

            // Wait for input debounce
            await waitFor(() => expect(mockHandleFilterChange).toHaveBeenCalled());
        });
    });
});
