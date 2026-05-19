import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import useBreakpoint from 'hooks/useBreakpoint';
import useUserContext from 'hooks/useUserContext';
import type { MouseEvent, ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { userService } from 'schema/user';
import UserSettings from 'user/UserSettings';

interface MenuItemContext {
    isLoggingOut: boolean;
}

interface MenuItemConfig {
    key: string;
    label: string | ((ctx: MenuItemContext) => string);
    icon: ReactNode | ((ctx: MenuItemContext) => ReactNode);
    onClick: () => void | Promise<void>;
    show?: boolean;
}

function UserMenuItem({
    item,
    isLoggingOut,
    onClose,
}: {
    item: MenuItemConfig;
    isLoggingOut: boolean;
    onClose: () => void;
}) {
    if (item.show === false) return null;
    const ctx = { isLoggingOut };
    const label = typeof item.label === 'function' ? item.label(ctx) : item.label;
    const icon = typeof item.icon === 'function' ? item.icon(ctx) : item.icon;

    return (
        <MenuItem
            onClick={() => {
                onClose();
                void item.onClick();
            }}
            disabled={isLoggingOut}
        >
            <ListItemIcon>{icon}</ListItemIcon>
            {label}
        </MenuItem>
    );
}

export default function UserMenu() {
    const { logout: deleteToken } = useAuthContext();
    const authFetch = useAuthFetch();
    const userAPI = useMemo(() => userService({ authFetch: authFetch }), [authFetch]);
    const navigate = useNavigate();
    const { isMobile } = useBreakpoint();
    const { hasRole } = useUserContext();
    const { pathname } = useLocation();

    /**
     * Menu dropdown
     */
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
    const menuOpen = Boolean(menuAnchorEl);

    /**
     * Settings modal
     */
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

    /**
     * Logout
     */
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

    const handleClickMenu = useCallback((event: MouseEvent<HTMLElement>) => {
        setMenuAnchorEl(event.currentTarget);
    }, []);

    const handleCloseMenu = useCallback(() => {
        setMenuAnchorEl(null);
    }, []);

    const handleOpenSettings = useCallback(() => {
        setSettingsOpen(true);
    }, []);

    const handleCloseSettings = useCallback((_event: object, reason: string) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        setSettingsOpen(false);
    }, []);

    // Call logout endpoint and delete JWT from browser
    const handleLogout = useCallback(async () => {
        setIsLoggingOut(true);
        try {
            await userAPI.logout();
        } catch (err: unknown) {
            console.error('Error logging out', err);
        } finally {
            // Always delete token
            deleteToken();
            void navigate('/');
            setIsLoggingOut(false);
        }
    }, [userAPI, deleteToken, navigate]);

    /**
     * Menu option configuration
     */
    const menuItems: MenuItemConfig[] = useMemo(
        () => [
            {
                key: 'home',
                label: 'Home',
                icon: <HomeIcon fontSize="small" />,
                onClick: () => void navigate('/'),
                show: isMobile || pathname.startsWith('/admin'),
            },
            {
                key: 'admin',
                label: 'Admin',
                icon: <DashboardIcon fontSize="small" />,
                onClick: () => void navigate('/admin'),
                show: hasRole('ADMIN') && !pathname.startsWith('/admin'),
            },
            {
                key: 'settings',
                label: 'Settings',
                icon: <SettingsIcon fontSize="small" />,
                onClick: handleOpenSettings,
            },
            {
                key: 'logout',
                label: ({ isLoggingOut }) => (isLoggingOut ? 'Logging out...' : 'Logout'),
                icon: ({ isLoggingOut }) =>
                    isLoggingOut ? <CircularProgress size={16} /> : <LogoutIcon fontSize="small" />,
                onClick: handleLogout,
            },
        ],
        [isMobile, pathname, hasRole, handleOpenSettings, handleLogout, navigate]
    );

    return (
        <>
            <Button
                variant="outlined"
                aria-label="Account menu"
                onClick={handleClickMenu}
                aria-expanded={menuOpen}
                disabled={isLoggingOut}
                sx={{ minHeight: 36 }}
            >
                <AccountCircleIcon sx={{ mx: 1 }} fontSize="small" />
            </Button>
            {menuOpen && (
                <Menu anchorEl={menuAnchorEl} id="account-menu" open={menuOpen} onClose={handleCloseMenu}>
                    {menuItems.map((item) => (
                        <UserMenuItem
                            key={item.key}
                            item={item}
                            isLoggingOut={isLoggingOut}
                            onClose={handleCloseMenu}
                        />
                    ))}
                </Menu>
            )}

            <UserSettings open={settingsOpen} onClose={handleCloseSettings} />
        </>
    );
}
