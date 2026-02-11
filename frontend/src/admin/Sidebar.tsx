import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { Link, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ListAltIcon from '@mui/icons-material/ListAlt';
import BugReportIcon from '@mui/icons-material/BugReport';
import SpeedIcon from '@mui/icons-material/Speed';
// import SettingsIcon from '@mui/icons-material/Settings';
import type { OverridableComponent } from '@mui/material/OverridableComponent';
import type { SvgIconTypeMap } from '@mui/material/SvgIcon';
import { DRAWER_WIDTH } from './Layout';
import StorageIcon from '@mui/icons-material/Storage';
import { useTheme } from '@mui/material/styles';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

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
        items: [{ label: 'Dashboard', path: '/admin', icon: DashboardIcon }],
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

export default function AdminSidebar() {
    const location = useLocation();
    const theme = useTheme();

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
            {adminNav.map((section) => (
                <Box key={section.section} sx={{ mt: 2 }}>
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
