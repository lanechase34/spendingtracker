import { createContext, ReactNode, useCallback, useMemo, useState } from 'react';

interface AdminDrawerContextType {
    mobileOpen: boolean;
    toggleDrawer: () => void;
}

export const AdminDrawerContext = createContext<AdminDrawerContextType | undefined>(undefined);

/**
 * Store the mobile drawer status for the admin layout
 */
export function AdminDrawerContextProvider({ children }: { children: ReactNode }) {
    const [mobileOpen, setMobileOpen] = useState<boolean>(false);
    const toggleDrawer = useCallback(() => setMobileOpen((prev) => !prev), []);

    const value: AdminDrawerContextType = useMemo(
        () => ({
            mobileOpen,
            toggleDrawer,
        }),
        [mobileOpen, toggleDrawer]
    );
    return <AdminDrawerContext value={value}>{children}</AdminDrawerContext>;
}
