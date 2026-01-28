import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';
import { ROLES } from 'types/Roles.type';
import type { UserRoles } from 'types/Roles.type';

export interface User {
    salary: number | null;
    monthlyTakeHome: number | null;
    role: UserRoles | null;
}

export interface UserContextType {
    user: User | null;
    loading: boolean;
    isAuthorized: () => boolean;
    hasRole: (role: UserRoles) => boolean;
}

// API Response Format
export const UserResponseSchema = validateAPIResponse(
    z.object({
        salary: z.number(),
        monthlytakehome: z.number(),
        role: z.enum(ROLES),
    })
);
