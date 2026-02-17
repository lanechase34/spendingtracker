import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import ListItemIcon from '@mui/material/ListItemIcon';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useAuthContext from 'hooks/useAuthContext';
import useAuthFetch from 'hooks/useAuthFetch';
import type { MouseEvent } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from 'schema/user';

import UserSettings from './UserSettings';

export default function UserMenu() {
    const { logout: deleteToken } = useAuthContext();
    const authFetch = useAuthFetch();
    const userAPI = useMemo(() => userService({ authFetch: authFetch }), [authFetch]);
    const navigate = useNavigate();
    const theme = useTheme();
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

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

    const handleClickMenu = (event: MouseEvent<HTMLElement>) => {
        setMenuAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => setMenuAnchorEl(null);

    const handleOpenSettings = () => {
        handleCloseMenu();
        setSettingsOpen(true);
    };

    const handleCloseSettings = (_event: object, reason: string) => {
        if (reason === 'backdropClick') return;
        setSettingsOpen(false);
    };

    // Call logout endpoint and delete JWT from browser
    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await userAPI.logout();
        } catch (err: unknown) {
            console.error('Error logging out', err);
        }
        // Always delete token
        deleteToken();
        void navigate('/');
        setIsLoggingOut(false);
    };

    return (
        <>
            <Button variant="outlined" onClick={handleClickMenu} aria-expanded={menuOpen} disabled={isLoggingOut}>
                <AccountCircleIcon sx={{ mx: 1 }} fontSize="small" />
            </Button>
            {menuOpen && (
                <Menu anchorEl={menuAnchorEl} id="account-menu" open={menuOpen} onClose={handleCloseMenu}>
                    {isSmallScreen && (
                        <MenuItem onClick={() => void navigate('/')}>
                            <ListItemIcon>
                                <HomeIcon fontSize="small" />
                            </ListItemIcon>
                            Home
                        </MenuItem>
                    )}
                    <MenuItem onClick={handleOpenSettings} disabled={isLoggingOut}>
                        <ListItemIcon>
                            <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        Settings
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            void handleLogout();
                        }}
                        disabled={isLoggingOut}
                    >
                        <ListItemIcon>
                            {isLoggingOut ? <CircularProgress size={16} /> : <LogoutIcon fontSize="small" />}
                        </ListItemIcon>
                        {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </MenuItem>
                </Menu>
            )}

            <UserSettings open={settingsOpen} onClose={handleCloseSettings} />
        </>
    );
}
