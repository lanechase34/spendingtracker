import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, RenderHookOptions, RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

import { AuthContext, AuthContextProvider } from './contexts/AuthContext';
import { DateRangeContextProvider } from './contexts/DateRangeContext';
import type { ExpenseContextType } from './contexts/ExpenseContext';
import { ExpenseContext, ExpenseContextProvider } from './contexts/ExpenseContext';
import type { SubscriptionContextType } from './contexts/SubscriptionContext';
import { SubscriptionContext, SubscriptionContextProvider } from './contexts/SubscriptionContext';
import type { ToastContextType } from './contexts/ToastContext';
import { ToastContext, ToastContextProvider } from './contexts/ToastContext';
import { UserContext, UserContextProvider } from './contexts/UserContext';
import type { AuthContextType } from './types/AuthContext.type';
import type { UserContextType } from './types/UserContext.type';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    toastContextValue?: ToastContextType;
    authContextValue?: AuthContextType;
    userContextValue?: UserContextType;
    expenseContextValue?: ExpenseContextType;
    subscriptionContextValue?: SubscriptionContextType;
    queryClient?: QueryClient;
}

interface CustomRenderHookOptions<Props> extends Omit<RenderHookOptions<Props>, 'wrapper'> {
    toastContextValue?: ToastContextType;
    authContextValue?: AuthContextType;
    userContextValue?: UserContextType;
    expenseContextValue?: ExpenseContextType;
    subscriptionContextValue?: SubscriptionContextType;
    queryClient?: QueryClient;
}

// Type safety for mock results for abort controller
export interface MockAbortController {
    signal: EventTarget;
    abort: jest.Mock;
}

/**
 * Mock a default toast context state
 */
const defaultToastContextValue: ToastContextType = {
    showToast: () => {
        /* empty */
    },
};

/**
 * Mock a default auth context state
 */
const defaultAuthContextValue: AuthContextType = {
    authToken: 'placeholder',
    getLatestAuthToken: () => {
        return 'placeholder';
    },
    login: async () => {
        return await Promise.resolve();
    },
    logout: () => {
        /* empty */
    },
    refreshToken: async () => {
        return Promise.resolve('refresh_token');
    },
    csrfToken: 'csrf_token',
    getCsrfToken: async () => {
        return Promise.resolve('csrf_token');
    },
    userJustLoggedIn: false,
    clearUserJustLoggedIn: () => {
        /*empty*/
    },
    pendingToken: '',
    setPendingToken: () => {
        /*empty*/
    },
    isInitializing: () => {
        return false;
    },
    isAuthenticated: () => {
        return false;
    },
    wasAuthenticated: false,
};

/**
 * Mock a default user context state
 */
const defaultUserContextValue: UserContextType = {
    user: {
        salary: 1,
        monthlyTakeHome: 1,
        role: 'USER',
    },
    loading: false,
    isAuthorized: () => {
        return true;
    },
    hasRole: () => {
        return true;
    },
};

/**
 * Mock a default expense context state
 */
const defaultExpenseContextValue: ExpenseContextType = {
    expenses: [],
    totalSum: null,
    filteredSum: null,
    deleteExpense: async () => {
        return await Promise.resolve();
    },
    loading: false,
    error: false,
    paginationModel: { page: 0, pageSize: 10 },
    setPaginationModel: () => {
        /*empty*/
    },
    sortModel: [],
    setSortModel: () => {
        /*empty*/
    },
    filterModel: { quickFilterValues: [], items: [] },
    setFilterModel: () => {
        /*empty*/
    },
    totalRowCount: 0,
    refetch: async () => {
        return await Promise.resolve();
    },
    resetState: () => {
        /*empty*/
    },
    handlePaginationModelChange: () => {
        /*empty*/
    },
    handleSortModelChange: () => {
        /*empty*/
    },
    handleFilterModelChange: () => {
        /*empty*/
    },
};

/**
 * Mock a default subscription context state
 */
const defaultSubscriptionContextValue: SubscriptionContextType = {
    subscriptions: [],
    totalSum: null,
    filteredSum: null,
    deleteSubscription: async () => {
        return await Promise.resolve();
    },
    toggleSubscription: async () => {
        return await Promise.resolve();
    },
    selectedInterval: '',
    handleIntervalChange: () => {
        /*empty*/
    },
    loading: false,
    error: false,
    paginationModel: { page: 0, pageSize: 10 },
    setPaginationModel: () => {
        /*empty*/
    },
    sortModel: [],
    setSortModel: () => {
        /*empty*/
    },
    filterModel: { quickFilterValues: [], items: [] },
    setFilterModel: () => {
        /*empty*/
    },
    totalRowCount: 0,
    refetch: async () => {
        return await Promise.resolve();
    },
    resetState: () => {
        /*empty*/
    },
    handlePaginationModelChange: () => {
        /*empty*/
    },
    handleSortModelChange: () => {
        /*empty*/
    },
    handleFilterModelChange: () => {
        /*empty*/
    },
};

const STALE_TIME = 15 * 60 * 1000; // 15 minutes
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: STALE_TIME,
            refetchOnWindowFocus: false, // Disable refetch on tab switch
            retry: 1, // Retry failed requests once
        },
    },
});

/**
 * Build the UI using mocked contexts
 * Custom render function to use the providers
 * Use the raw context provider from createContext() to skip logic and just insert values
 */
function buildWrapper(opts: CustomRenderOptions | CustomRenderHookOptions<object>) {
    const {
        toastContextValue = defaultToastContextValue,
        authContextValue = defaultAuthContextValue,
        userContextValue = defaultUserContextValue,
        expenseContextValue = defaultExpenseContextValue,
        subscriptionContextValue = defaultSubscriptionContextValue,
        queryClient: providedQueryClient,
    } = opts;

    // Use provided queryClient or create a new one with test-friendly defaults
    const testQueryClient =
        providedQueryClient ??
        new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false, // Don't retry in tests
                    gcTime: 0, // Clear cache immediately
                },
            },
        });

    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={testQueryClient}>
            <ToastContext value={toastContextValue}>
                <AuthContext value={authContextValue}>
                    <UserContext value={userContextValue}>
                        <ExpenseContext value={expenseContextValue}>
                            <SubscriptionContext value={subscriptionContextValue}>{children}</SubscriptionContext>
                        </ExpenseContext>
                    </UserContext>
                </AuthContext>
            </ToastContext>
        </QueryClientProvider>
    );
}

/**
 * Custom render and hook functions to render using the MOCK providers
 */
const customRender = (ui: ReactElement, options: CustomRenderOptions = {}) => {
    return render(ui, {
        wrapper: buildWrapper(options),
        ...options,
    });
};

const customRenderHook = <Result, Props>(
    hook: (initialProps: Props) => Result,
    options: CustomRenderHookOptions<Props> = {}
) => {
    return renderHook(hook, {
        wrapper: buildWrapper(options),
        ...options,
    });
};

/**
 * Helper function to create expense context value
 */
export const createExpenseContext = (overrides?: Partial<ExpenseContextType>): ExpenseContextType => ({
    ...defaultExpenseContextValue,
    ...Object.fromEntries(
        Object.entries(defaultExpenseContextValue).map(([k, v]) => [k, typeof v === 'function' ? jest.fn() : v])
    ),
    ...overrides,
});

/**
 * Helper function to create subscription context value
 */
export const createSubscriptionContext = (overrides?: Partial<SubscriptionContextType>): SubscriptionContextType => ({
    ...defaultSubscriptionContextValue,
    ...Object.fromEntries(
        Object.entries(defaultSubscriptionContextValue).map(([k, v]) => [k, typeof v === 'function' ? jest.fn() : v])
    ),
    ...overrides,
});

export { customRender as render, customRenderHook as renderHook };

/**
 * Function to NOT use mocks and instead use the REAL providers
 * just like App.tsx
 */
const CONTEXT_MAP = [
    ToastContextProvider,
    AuthContextProvider,
    UserContextProvider,
    DateRangeContextProvider,
    ExpenseContextProvider,
    SubscriptionContextProvider,
];
const darkTheme = createTheme({ palette: { mode: 'dark' } });
export function Providers({ children }: { children: ReactNode }) {
    const wrapped = CONTEXT_MAP.reduceRight((acc, Provider) => {
        return <Provider>{acc}</Provider>;
    }, children);

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                {wrapped}
            </ThemeProvider>
        </QueryClientProvider>
    );
}
