import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useState, useMemo } from 'react';
import Button from '@mui/material/Button';
import type { MouseEvent } from 'react';
import UserSettings from './UserSettings';
import useAuthContext from 'hooks/useAuthContext';
import { userService } from 'schema/user';
import useAuthFetch from 'hooks/useAuthFetch';
import { useNavigate } from 'react-router-dom';

export default function UserMenu() {
    const { logout: deleteToken } = useAuthContext();
    const authFetch = useAuthFetch();
    const userAPI = useMemo(() => userService({ authFetch: authFetch }), [authFetch]);
    const navigate = useNavigate();

    /**
     * Menu dropdown
     */
    const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
    const menuOpen = Boolean(menuAnchorEl);

    /**
     * Settings modal
     */
    const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

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
        try {
            await userAPI.logout();
        } catch (err: unknown) {
            console.error('Error logging out', err);
        }
        deleteToken();
        void navigate('/');
    };

    return (
        <>
            <Button variant="outlined" onClick={handleClickMenu} aria-expanded={menuOpen}>
                <AccountCircleIcon sx={{ mx: 1 }} fontSize="small" />
            </Button>
            {menuOpen && (
                <Menu anchorEl={menuAnchorEl} id="account-menu" open={menuOpen} onClose={handleCloseMenu}>
                    <MenuItem onClick={handleOpenSettings}>
                        <ListItemIcon>
                            <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        Settings
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            void handleLogout();
                        }}
                    >
                        <ListItemIcon>
                            <LogoutIcon fontSize="small" />
                        </ListItemIcon>
                        Logout
                    </MenuItem>
                </Menu>
            )}

            <UserSettings open={settingsOpen} onClose={handleCloseSettings} />
        </>
    );
}
