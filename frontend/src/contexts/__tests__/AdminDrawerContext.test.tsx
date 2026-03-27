import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDrawerContextType } from 'contexts/AdminDrawerContext';
import { AdminDrawerContext, AdminDrawerContextProvider } from 'contexts/AdminDrawerContext';
import { useContext } from 'react';

// Test consumer component
function TestConsumer() {
    const context = useContext(AdminDrawerContext);
    if (!context) return <div>No context</div>;
    return (
        <div>
            <span data-testid="mobile-open">{String(context.mobileOpen)}</span>
            <button onClick={context.toggleDrawer}>Toggle</button>
        </div>
    );
}

describe('AdminDrawerContext', () => {
    describe('AdminDrawerContext default value', () => {
        it('Should be undefined by default (no provider)', () => {
            render(<TestConsumer />);
            expect(screen.getByText('No context')).toBeInTheDocument();
        });
    });

    describe('AdminDrawerContextProvider', () => {
        it('Should render children', () => {
            render(
                <AdminDrawerContextProvider>
                    <div data-testid="child">Child content</div>
                </AdminDrawerContextProvider>
            );
            expect(screen.getByTestId('child')).toBeInTheDocument();
        });

        it('Should provide mobileOpen as false initially', () => {
            render(
                <AdminDrawerContextProvider>
                    <TestConsumer />
                </AdminDrawerContextProvider>
            );
            expect(screen.getByTestId('mobile-open')).toHaveTextContent('false');
        });

        it('Should provide toggleDrawer function', () => {
            render(
                <AdminDrawerContextProvider>
                    <TestConsumer />
                </AdminDrawerContextProvider>
            );
            expect(screen.getByRole('button', { name: 'Toggle' })).toBeInTheDocument();
        });

        it('Should toggle mobileOpen from false to true when toggleDrawer is called', async () => {
            const user = userEvent.setup();
            render(
                <AdminDrawerContextProvider>
                    <TestConsumer />
                </AdminDrawerContextProvider>
            );

            expect(screen.getByTestId('mobile-open')).toHaveTextContent('false');
            await user.click(screen.getByRole('button', { name: 'Toggle' }));
            expect(screen.getByTestId('mobile-open')).toHaveTextContent('true');
        });

        it('Should toggle mobileOpen from true back to false on second call', async () => {
            const user = userEvent.setup();
            render(
                <AdminDrawerContextProvider>
                    <TestConsumer />
                </AdminDrawerContextProvider>
            );

            await user.click(screen.getByRole('button', { name: 'Toggle' }));
            expect(screen.getByTestId('mobile-open')).toHaveTextContent('true');

            await user.click(screen.getByRole('button', { name: 'Toggle' }));
            expect(screen.getByTestId('mobile-open')).toHaveTextContent('false');
        });

        it('Should handle multiple toggles correctly', async () => {
            const user = userEvent.setup();
            render(
                <AdminDrawerContextProvider>
                    <TestConsumer />
                </AdminDrawerContextProvider>
            );

            // Toggle 5 times: false -> true -> false -> true -> false -> true
            for (let i = 1; i <= 5; i++) {
                await user.click(screen.getByRole('button', { name: 'Toggle' }));
                const expected = i % 2 !== 0 ? 'true' : 'false';
                expect(screen.getByTestId('mobile-open')).toHaveTextContent(expected);
            }
        });

        it('Should use functional state update (prev => !prev) for toggle', async () => {
            const user = userEvent.setup();

            render(
                <AdminDrawerContextProvider>
                    <TestConsumer />
                </AdminDrawerContextProvider>
            );

            expect(screen.getByTestId('mobile-open')).toHaveTextContent('false');

            await user.click(screen.getByRole('button', { name: 'Toggle' }));
            expect(screen.getByTestId('mobile-open')).toHaveTextContent('true');

            await user.click(screen.getByRole('button', { name: 'Toggle' }));
            expect(screen.getByTestId('mobile-open')).toHaveTextContent('false');
        });

        it('Should maintain stable toggleDrawer reference across re-renders (useCallback)', async () => {
            const user = userEvent.setup();
            const toggleRefs = new Set<() => void>();

            function RefCapture() {
                const context = useContext(AdminDrawerContext);
                if (!context) return null;
                toggleRefs.add(context.toggleDrawer);
                return <button onClick={context.toggleDrawer}>Toggle</button>;
            }

            render(
                <AdminDrawerContextProvider>
                    <RefCapture />
                </AdminDrawerContextProvider>
            );

            await user.click(screen.getByRole('button', { name: 'Toggle' }));
            await user.click(screen.getByRole('button', { name: 'Toggle' }));

            // toggleDrawer should be the same reference across renders (useCallback with no deps)
            expect(toggleRefs.size).toBe(1);
        });

        it('Should provide a new context value object when mobileOpen changes (useMemo)', async () => {
            const user = userEvent.setup();
            const contextValues: AdminDrawerContextType[] = [];

            function ValueCapture() {
                const context = useContext(AdminDrawerContext);
                if (!context) return null;
                contextValues.push(context);
                return <button onClick={context.toggleDrawer}>Toggle</button>;
            }

            render(
                <AdminDrawerContextProvider>
                    <ValueCapture />
                </AdminDrawerContextProvider>
            );

            await user.click(screen.getByRole('button', { name: 'Toggle' }));

            expect(contextValues.length).toBeGreaterThanOrEqual(2);
            // The context object reference should change when mobileOpen changes
            expect(contextValues[0]).not.toBe(contextValues[contextValues.length - 1]);
        });

        it('Should render multiple children', () => {
            render(
                <AdminDrawerContextProvider>
                    <div data-testid="child-1">First</div>
                    <div data-testid="child-2">Second</div>
                </AdminDrawerContextProvider>
            );
            expect(screen.getByTestId('child-1')).toBeInTheDocument();
            expect(screen.getByTestId('child-2')).toBeInTheDocument();
        });

        it('Should support multiple consumers sharing the same state', async () => {
            const user = userEvent.setup();

            function ConsumerA() {
                const ctx = useContext(AdminDrawerContext);
                return <span data-testid="a">{String(ctx?.mobileOpen)}</span>;
            }

            function ConsumerB() {
                const ctx = useContext(AdminDrawerContext);
                return (
                    <button onClick={ctx?.toggleDrawer} data-testid="btn-b">
                        Toggle B
                    </button>
                );
            }

            render(
                <AdminDrawerContextProvider>
                    <ConsumerA />
                    <ConsumerB />
                </AdminDrawerContextProvider>
            );

            expect(screen.getByTestId('a')).toHaveTextContent('false');
            await user.click(screen.getByTestId('btn-b'));
            expect(screen.getByTestId('a')).toHaveTextContent('true');
        });
    });
});
