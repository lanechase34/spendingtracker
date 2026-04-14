import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import ButtonGroup from '@mui/material/ButtonGroup';
import Container from '@mui/material/Container';
import { useTheme } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { SidebarIcon } from 'admin/Sidebar';
import NavBtn from 'components/NavBtn';
import useAuthContext from 'hooks/useAuthContext';
import useBreakpoint from 'hooks/useBreakpoint';
import useUserContext from 'hooks/useUserContext';
import type { ReactNode } from 'react';
import { Fragment, lazy, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LoginDialogButton from 'user/LoginDialogButton';
import RegisterDialogButton from 'user/RegisterDialogButton';
import UserMenu from 'user/UserMenu';
import { withSuspense } from 'utils/withSuspense';

const DateRangeSelector = lazy(() => import('./DateRangeSelector'));
const ExpenseForm = lazy(() => import('expense/ExpenseForm'));

interface NavButton {
    id: string;
    node: ReactNode;
}

/**
 * Build available navbar buttons based on current url route
 */
function buildRouteButtons({
    pathname,
    isAuthorized,
    buttonSize,
}: {
    pathname: string;
    isAuthorized: () => boolean;
    buttonSize: 'small' | 'medium';
}): NavButton[] {
    const routes: Record<string, () => NavButton[]> = {
        '/': () =>
            isAuthorized()
                ? [
                      {
                          id: 'go-to-dashboard',
                          node: <NavBtn url="/dashboard" text="Go to Dashboard" />,
                      },
                  ]
                : [
                      {
                          id: 'login',
                          node: <LoginDialogButton icon={<LoginIcon sx={{ mr: 1 }} />} size={buttonSize} />,
                      },
                      {
                          id: 'register',
                          node: <RegisterDialogButton icon={<PersonAddIcon sx={{ mr: 1 }} />} size={buttonSize} />,
                      },
                  ],
        '/dashboard': () => [
            { id: 'date-range-selector', node: withSuspense(<DateRangeSelector />) },
            { id: 'expense-form', node: withSuspense(<ExpenseForm />) },
        ],
        '/admin': () => [{ id: 'admin-date-range-selector', node: withSuspense(<DateRangeSelector />) }],
        '/admin/audit': () => [{ id: 'admin-audit-date-range-selector', node: withSuspense(<DateRangeSelector />) }],
        '/admin/bug': () => [{ id: 'admin-bug-date-range-selector', node: withSuspense(<DateRangeSelector />) }],
    };

    return routes[pathname]?.() ?? [];
}

/**
 * Navbar for application, will show different buttons based on the user's authorization and the current page
 */
export default function Navbar() {
    const { isInitializing } = useAuthContext();
    const { isAuthorized, loading: userLoading } = useUserContext();
    const { pathname } = useLocation();

    const theme = useTheme();
    const { isMobile } = useBreakpoint();
    const buttonSize = isMobile ? 'small' : 'medium';

    // If this is an admin route
    const isAdminRoute = pathname.startsWith('/admin');

    const routeButtons = useMemo(() => {
        if (isInitializing() || userLoading) {
            return [];
        }

        const buttons = buildRouteButtons({
            pathname,
            isAuthorized,
            buttonSize,
        });

        // Show user menu for fully loaded users
        if (isAuthorized()) {
            buttons.push({
                id: 'user-menu',
                node: <UserMenu />,
            });
        }

        return buttons;
    }, [pathname, isAuthorized, isInitializing, userLoading, buttonSize]);

    return (
        <AppBar
            position="sticky"
            elevation={0}
            sx={{
                bgcolor: theme.palette.background.paper,
                backgroundImage:
                    theme.palette.mode === 'dark'
                        ? 'linear-gradient(rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.09))'
                        : 'none',
            }}
        >
            <Container disableGutters maxWidth={false}>
                <Toolbar
                    disableGutters
                    variant="dense"
                    sx={{ pl: { xs: isAdminRoute ? 1 : 2, md: 2 }, pr: 2, py: { xs: 1, md: 0 } }}
                >
                    {isAdminRoute && isMobile ? (
                        <SidebarIcon />
                    ) : (
                        <>
                            <TrendingUpIcon color="success" sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />

                            <Typography
                                variant="h6"
                                component={Link}
                                to={'/'}
                                sx={{
                                    color: 'inherit',
                                    display: {
                                        xs: 'none',
                                        md: 'block',
                                        textDecoration: 'none',
                                        width: 'fit-content',
                                    },
                                }}
                            >
                                SpendingTracker
                            </Typography>
                        </>
                    )}

                    {/* This spacer always pushes the button group to the right */}
                    <Box sx={{ flexGrow: 1 }} />

                    {routeButtons.length > 0 && (
                        <ButtonGroup variant="outlined" aria-label="Navigation Buttons">
                            {routeButtons.map(({ id, node }) => (
                                <Fragment key={id}>{node}</Fragment>
                            ))}
                        </ButtonGroup>
                    )}
                </Toolbar>
            </Container>
        </AppBar>
    );
}
