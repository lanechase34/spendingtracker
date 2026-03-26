import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import AdminSidebar from 'admin/Sidebar';
import useAdminDrawerContext from 'hooks/useAdminDrawerContext';
import useBreakpoint from 'hooks/useBreakpoint';
import { ReactNode } from 'react';

interface AdminLayoutProps {
    children: ReactNode;
}

export const DRAWER_WIDTH = 240;

export default function AdminLayout({ children }: AdminLayoutProps) {
    const { isMobile } = useBreakpoint();
    const { mobileOpen, toggleDrawer } = useAdminDrawerContext();

    return (
        <Box sx={{ display: 'flex' }}>
            {/* Desktop sidebar */}
            {!isMobile && <AdminSidebar />}

            {/* Mobile drawer */}
            {isMobile && (
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={toggleDrawer}
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
