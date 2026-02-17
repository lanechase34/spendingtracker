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
import useMediaQuery from '@mui/material/useMediaQuery';
import NavBtn from 'components/NavBtn';
import ExpenseForm from 'expense/ExpenseForm';
import useAuthContext from 'hooks/useAuthContext';
import useUserContext from 'hooks/useUserContext';
import type { ReactNode } from 'react';
import { Fragment, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LoginDialogButton from 'user/LoginDialogButton';
import RegisterDialogButton from 'user/RegisterDialogButton';
import UserMenu from 'user/UserMenu';

import DateRangeSelector from './DateRangeSelector';

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
            { id: 'date-range-selector', node: <DateRangeSelector /> },
            { id: 'expense-form', node: <ExpenseForm /> },
        ],

        '/admin': () => [{ id: 'admin-date-range-selector', node: <DateRangeSelector /> }],
        '/admin/audit': () => [{ id: 'admin-audit-date-range-selector', node: <DateRangeSelector /> }],
        '/admin/bug': () => [{ id: 'admin-bug-date-range-selector', node: <DateRangeSelector /> }],
    };

    return routes[pathname]?.() ?? [];
}

/**
 * Navbar for application, will show different buttons based on the user's authorization and the current page
 */
export default function Navbar() {
    const { isInitializing } = useAuthContext();
    const { isAuthorized } = useUserContext();
    const { pathname } = useLocation();

    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const buttonSize = isSmallScreen ? 'small' : 'medium';

    const routeButtons = useMemo(() => {
        if (isInitializing()) return [];

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
    }, [pathname, isAuthorized, isInitializing, buttonSize]);

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
                <Toolbar disableGutters variant="dense" sx={{ px: 2, py: { xs: 1, md: 0 } }}>
                    <TrendingUpIcon color="success" sx={{ display: { xs: 'none', md: 'flex' }, mr: 1 }} />

                    <Box sx={{ flexGrow: 1 }}>
                        <Typography
                            sx={{ display: { xs: 'none', md: 'block', textDecoration: 'none', width: 'fit-content' } }}
                            variant="h6"
                            color="inherit"
                            component={Link}
                            to={'/'}
                        >
                            SpendingTracker
                        </Typography>
                    </Box>

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
