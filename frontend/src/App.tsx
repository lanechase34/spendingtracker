import 'App.css';
import '@fontsource-variable/roboto';

import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminLayout from 'admin/Layout';
import Navbar from 'components/Navbar';
import PageLoader from 'components/PageLoader';
import PostLoginRedirect from 'components/PostLoginRedirect';
import RoleProtectedRoute from 'components/RoleProtectedRoute';
import { AdminDrawerContextProvider } from 'contexts/AdminDrawerContext';
import { AuthContextProvider } from 'contexts/AuthContext';
import { AuthDialogContextProvider } from 'contexts/AuthDialogContext';
import { DateRangeContextProvider } from 'contexts/DateRangeContext';
import { ExpenseContextProvider } from 'contexts/ExpenseContext';
import { SubscriptionContextProvider } from 'contexts/SubscriptionContext';
import { ToastContextProvider } from 'contexts/ToastContext';
import { UserContextProvider } from 'contexts/UserContext';
import About from 'pages/About';
import type { ReactNode } from 'react';
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Outlet, Route, Routes, useMatch } from 'react-router-dom';
import { ROLES } from 'types/Roles.type';

// Admin pages
const AuditLogPage = lazy(() => import('admin/pages/AuditLogPage'));
const BugLogPage = lazy(() => import('admin/pages/BugLogPage'));
const CachePage = lazy(() => import('admin/pages/CachePage'));
const AdminDashboard = lazy(() => import('admin/pages/Dashboard'));
const MetricsPage = lazy(() => import('admin/pages/MetricsPage'));
const TasksPage = lazy(() => import('admin/pages/TasksPage'));
const UsersPage = lazy(() => import('admin/pages/UsersPage'));
const ServerLogsPage = lazy(() => import('admin/pages/ServerLogs'));

const MetricContextProvider = lazy(() =>
    import('contexts/MetricContext').then((m) => ({ default: m.MetricContextProvider }))
);

// Pages
const Dashboard = lazy(() => import('pages/Dashboard'));
const NotFound = lazy(() => import('pages/NotFound'));
const Unauthorized = lazy(() => import('pages/Unauthorized'));

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
    typography: {
        fontFamily: '"Roboto Variable", "Roboto", "Helvetica", "Arial", sans-serif',
    },
});

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
 * Creates context tree using providers
 */
const CONTEXT_MAP = [
    ToastContextProvider,
    AuthContextProvider,
    AuthDialogContextProvider,
    AdminDrawerContextProvider,
    UserContextProvider,
    DateRangeContextProvider,
];

function Providers({ children }: { children: ReactNode }) {
    const wrapped = CONTEXT_MAP.reduceRight((acc, Provider) => {
        return <Provider>{acc}</Provider>;
    }, children);

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline enableColorScheme />
            {wrapped}
        </ThemeProvider>
    );
}

/**
 * Expense and subscription data is only shown on the dashboard
 * The providers stay mounted everywhere (the navbar's expense form uses them) but only fetch on the dashboard
 */
function DashboardDataProviders({ children }: { children: ReactNode }) {
    const isDashboard = useMatch('/dashboard') != null;

    return (
        <ExpenseContextProvider enabled={isDashboard}>
            <SubscriptionContextProvider enabled={isDashboard}>{children}</SubscriptionContextProvider>
        </ExpenseContextProvider>
    );
}

function AppRouter() {
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<About />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* User routes */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.USER, ROLES.ADMIN]} />}>
                <Route path="/dashboard" element={<Dashboard />} />
            </Route>

            {/* Admin routes */}
            <Route element={<RoleProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
                <Route
                    element={
                        <Suspense fallback={<PageLoader />}>
                            <MetricContextProvider>
                                <AdminLayout>
                                    <Outlet />
                                </AdminLayout>
                            </MetricContextProvider>
                        </Suspense>
                    }
                >
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/audit" element={<AuditLogPage />} />
                    <Route path="/admin/bug" element={<BugLogPage />} />
                    <Route path="/admin/metrics" element={<MetricsPage />} />
                    <Route path="/admin/cache" element={<CachePage />} />
                    <Route path="/admin/tasks" element={<TasksPage />} />
                    <Route path="/admin/users" element={<UsersPage />} />
                    <Route path="/admin/server-logs" element={<ServerLogsPage />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router basename={import.meta.env.BASE_URL}>
                <Providers>
                    <DashboardDataProviders>
                        <Navbar />
                        <PostLoginRedirect />
                        <Suspense fallback={<PageLoader />}>
                            <AppRouter />
                        </Suspense>
                    </DashboardDataProviders>
                </Providers>
            </Router>
        </QueryClientProvider>
    );
}
