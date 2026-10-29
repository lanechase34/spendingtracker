import { render } from '@test-utils';
import { screen } from '@testing-library/react';
import RoleProtectedRoute from 'components/RoleProtectedRoute';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { AuthContextType } from 'types/AuthContext.type';
import type { UserRoles } from 'types/Roles.type';
import { ROLES } from 'types/Roles.type';
import type { User, UserContextType } from 'types/UserContext.type';

interface Scenario {
    authToken: string | null;
    user: User | null;
    loading?: boolean;
    allowedRoles?: UserRoles[];
}

const userWithRole = (role: UserRoles | null): User => ({
    salary: 1,
    monthlyTakeHome: 1,
    role,
    totpEnabled: false,
});

/**
 * Renders the guard in front of a protected page, with landing pages for each redirect target
 */
function renderRoute({ authToken, user, loading = false, allowedRoles = [ROLES.ADMIN] }: Scenario) {
    return render(
        <MemoryRouter initialEntries={['/protected']}>
            <Routes>
                <Route path="/" element={<div>Home page</div>} />
                <Route path="/unauthorized" element={<div>Unauthorized page</div>} />
                <Route element={<RoleProtectedRoute allowedRoles={allowedRoles} />}>
                    <Route path="/protected" element={<div>Protected page</div>} />
                </Route>
            </Routes>
        </MemoryRouter>,
        {
            // The guard only reads these fields
            authContextValue: { authToken } as AuthContextType,
            userContextValue: { user, loading } as UserContextType,
        }
    );
}

describe('<RoleProtectedRoute />', () => {
    it('Should show a loader while the profile loads', () => {
        renderRoute({ authToken: 'token', user: null, loading: true });

        expect(screen.getByRole('progressbar')).toBeInTheDocument();
        expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
    });

    it('Should keep showing the page during a background reload once the user is known', () => {
        renderRoute({ authToken: 'token', user: userWithRole(ROLES.ADMIN), loading: true });

        expect(screen.getByText('Protected page')).toBeInTheDocument();
    });

    it('Should send a visitor without a token home', () => {
        renderRoute({ authToken: null, user: userWithRole(ROLES.ADMIN) });

        expect(screen.getByText('Home page')).toBeInTheDocument();
        expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
    });

    it('Should send a visitor home when the profile finished loading without a token', () => {
        renderRoute({ authToken: null, user: null });

        expect(screen.getByText('Home page')).toBeInTheDocument();
    });

    it('Should not treat an empty token as logged out', () => {
        renderRoute({ authToken: '', user: userWithRole(ROLES.ADMIN) });

        expect(screen.getByText('Protected page')).toBeInTheDocument();
    });

    it.each([
        ['has no profile', null],
        ['has no role', userWithRole(null)],
        ['has a role that is not allowed', userWithRole(ROLES.USER)],
    ])('Should send a logged in user who %s to unauthorized', (_label, user) => {
        renderRoute({ authToken: 'token', user, allowedRoles: [ROLES.ADMIN] });

        expect(screen.getByText('Unauthorized page')).toBeInTheDocument();
        expect(screen.queryByText('Protected page')).not.toBeInTheDocument();
    });

    it.each([
        ['an admin on an admin route', ROLES.ADMIN, [ROLES.ADMIN]],
        ['a user on a user route', ROLES.USER, [ROLES.USER, ROLES.ADMIN]],
        ['an admin on a user route', ROLES.ADMIN, [ROLES.USER, ROLES.ADMIN]],
    ])('Should render the page for %s', (_label, role, allowedRoles) => {
        renderRoute({ authToken: 'token', user: userWithRole(role), allowedRoles });

        expect(screen.getByText('Protected page')).toBeInTheDocument();
    });

    it('Should deny everyone when no roles are allowed', () => {
        renderRoute({ authToken: 'token', user: userWithRole(ROLES.ADMIN), allowedRoles: [] });

        expect(screen.getByText('Unauthorized page')).toBeInTheDocument();
    });
});
