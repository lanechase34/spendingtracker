import { ReactNode, useState } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import AdminSidebar from 'admin/Sidebar';
import useBreakpoint from 'hooks/useBreakpoint';

interface AdminLayoutProps {
    children: ReactNode;
}

export const DRAWER_WIDTH = 240;

export default function AdminLayout({ children }: AdminLayoutProps) {
    const { isMobile } = useBreakpoint();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    return (
        <Box sx={{ display: 'flex' }}>
            {/* Mobile menu button */}
            {isMobile && (
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={handleDrawerToggle}
                    sx={{ position: 'fixed', top: 8, left: 8, zIndex: 1300 }}
                >
                    <MenuIcon />
                </IconButton>
            )}

            {/* Desktop sidebar */}
            {!isMobile && <AdminSidebar />}

            {/* Mobile drawer */}
            {isMobile && (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true, // Better open performance on mobile
                    }}
                    sx={{
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: DRAWER_WIDTH,
                        },
                    }}
                >
                    <AdminSidebar />
                </Drawer>
            )}

            {/* Main content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 2,
                    ml: { xs: 0, md: `${DRAWER_WIDTH}px` },
                    width: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
