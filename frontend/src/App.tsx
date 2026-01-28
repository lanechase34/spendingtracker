import { BrowserRouter as Router, Route, Routes, Outlet } from 'react-router-dom';
import Dashboard from 'pages/Dashboard';
import About from 'pages/About';
import 'App.css';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Navbar from 'components/Navbar';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { DateRangeContextProvider } from 'contexts/DateRangeContext';
import { UserContextProvider } from 'contexts/UserContext';
import { ExpenseContextProvider } from 'contexts/ExpenseContext';
import { SubscriptionContextProvider } from 'contexts/SubscriptionContext';
import { ToastContextProvider } from 'contexts/ToastContext';
import { AuthDialogContextProvider } from 'contexts/AuthDialogContext';
import { AuthContextProvider } from 'contexts/AuthContext';
import type { ReactNode } from 'react';
import RoleProtectedRoute from 'components/RoleProtectedRoute';
import Unauthorized from 'pages/Unauthorized';
import { ROLES } from 'types/Roles.type';
import AdminDashboard from 'admin/pages/Dashboard';
import AuditLogPage from 'admin/pages/AuditLogPage';
import BugLogPage from 'admin/pages/BugLogPage';
import MetricsPage from 'admin/pages/MetricsPage';
import CachePage from 'admin/pages/CachePage';
import TasksPage from 'admin/pages/TasksPage';
import UsersPage from 'admin/pages/UsersPage';
import PostLoginRedirect from 'components/PostLoginRedirect';
import NotFound from 'pages/NotFound';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MetricContextProvider } from 'contexts/MetricContext';

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
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
    UserContextProvider,
    DateRangeContextProvider,
    ExpenseContextProvider,
    SubscriptionContextProvider,
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
                        <MetricContextProvider>
                            <Outlet />
                        </MetricContextProvider>
                    }
                >
                    <Route path="/admin" element={<AdminDashboard />} />
                    <Route path="/admin/audit" element={<AuditLogPage />} />
                    <Route path="/admin/bug" element={<BugLogPage />} />
                    <Route path="/admin/metrics" element={<MetricsPage />} />
                    <Route path="/admin/cache" element={<CachePage />} />
                    <Route path="/admin/tasks" element={<TasksPage />} />
                    <Route path="/admin/users" element={<UsersPage />} />
                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}

export default function App() {
    // All routes are prefixed with /spendingtracker
    const basename = '/spendingtracker';
    return (
        <QueryClientProvider client={queryClient}>
            <Providers>
                <Router basename={basename}>
                    <Navbar />
                    <PostLoginRedirect />
                    <Box component="main"></Box>
                    <AppRouter />
                </Router>
            </Providers>
        </QueryClientProvider>
    );
}
