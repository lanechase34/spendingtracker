import BugReportIcon from '@mui/icons-material/BugReport';
import DashboardIcon from '@mui/icons-material/Dashboard';
import HomeIcon from '@mui/icons-material/Home';
import ListAltIcon from '@mui/icons-material/ListAlt';
// import SettingsIcon from '@mui/icons-material/Settings';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SpeedIcon from '@mui/icons-material/Speed';
import StorageIcon from '@mui/icons-material/Storage';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import type { OverridableComponent } from '@mui/material/OverridableComponent';
import { useTheme } from '@mui/material/styles';
import type { SvgIconTypeMap } from '@mui/material/SvgIcon';
import Typography from '@mui/material/Typography';
import useAdminDrawerContext from 'hooks/useAdminDrawerContext';
import useBreakpoint from 'hooks/useBreakpoint';
import { Link, useLocation } from 'react-router-dom';

import { DRAWER_WIDTH } from './Layout';

interface NavItem {
    label: string;
    path: string;
    icon: OverridableComponent<SvgIconTypeMap>;
}

interface NavSection {
    section: string;
    items: NavItem[];
}

export const adminNav: NavSection[] = [
    {
        section: 'Overview',
        items: [
            { label: 'Home', path: '/', icon: HomeIcon },
            { label: 'Dashboard', path: '/admin', icon: DashboardIcon },
        ],
    },
    {
        section: 'Logs',
        items: [
            { label: 'Audit Log', path: '/admin/audit', icon: ListAltIcon },
            { label: 'Bug Log', path: '/admin/bug', icon: BugReportIcon },
        ],
    },
    {
        section: 'Performance',
        items: [
            { label: 'Metrics', path: '/admin/metrics', icon: SpeedIcon },
            { label: 'Cache', path: '/admin/cache', icon: StorageIcon },
        ],
    },
    {
        section: 'System',
        items: [
            { label: 'Task Manager', path: '/admin/tasks', icon: TaskAltIcon },
            // { label: 'Settings', path: '/admin/settings', icon: SettingsIcon },
            { label: 'Users', path: '/admin/users', icon: PeopleAltIcon },
        ],
    },
];

export function SidebarIcon() {
    const { toggleDrawer } = useAdminDrawerContext();
    return (
        <IconButton color="inherit" aria-label="open navigation drawer" onClick={toggleDrawer} sx={{ m: 0 }}>
            <MenuIcon />
        </IconButton>
    );
}

export default function AdminSidebar() {
    const location = useLocation();
    const theme = useTheme();
    const { isMobile } = useBreakpoint();
    const { toggleDrawer } = useAdminDrawerContext();

    return (
        <Box
            sx={{
                width: DRAWER_WIDTH,
                position: 'fixed',
                height: '100vh',
                bgcolor: theme.palette.background.paper,
                backgroundImage:
                    theme.palette.mode === 'dark'
                        ? 'linear-gradient(rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.09))'
                        : 'none',
            }}
        >
            {isMobile && (
                <Box sx={{ pl: 1, pr: 2, pt: 1 }}>
                    <SidebarIcon />
                </Box>
            )}

            {adminNav.map((section) => (
                <Box key={section.section} sx={{ mt: 1 }}>
                    <Typography variant="overline" color="text.secondary" sx={{ px: 2 }}>
                        {section.section}
                    </Typography>

                    <List disablePadding>
                        {section.items.map(({ label, path, icon: Icon }) => {
                            const isActive = location.pathname === path;
                            return (
                                <ListItemButton
                                    key={path}
                                    component={Link}
                                    to={path}
                                    selected={isActive}
                                    onClick={isMobile ? toggleDrawer : undefined}
                                    sx={{
                                        borderRadius: 1,
                                        mx: 1,
                                        '&.active': {
                                            bgcolor: 'action.selected',
                                            '&:hover': {
                                                bgcolor: 'action.selected',
                                            },
                                            '& .MuiListItemIcon-root': {
                                                color: 'primary.main',
                                            },
                                        },
                                    }}
                                >
                                    <ListItemIcon>
                                        <Icon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary={label} />
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Box>
            ))}
        </Box>
    );
}
