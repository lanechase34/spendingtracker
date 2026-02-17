import useAuthContext from 'hooks/useAuthContext';
import useUserContext from 'hooks/useUserContext';
import { Navigate, Outlet } from 'react-router-dom';
import type { UserRoles } from 'types/Roles.type';

interface RoleProtectedRouteProps {
    allowedRoles: UserRoles[];
}

export default function RoleProtectedRoute({ allowedRoles }: RoleProtectedRouteProps) {
    const { authToken } = useAuthContext();
    const { user, loading } = useUserContext();

    /**
     * Initial load
     */
    if (loading && !user) {
        return null;
    }

    /**
     * Auth failed -> not logged in
     */
    if (!authToken) {
        return <Navigate to="/" replace />;
    }

    /**
     * User loaded but missing role or they their role is not listed as allowed for this route
     */
    if (!user?.role || !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />;
}
