import type { UserRoles } from 'types/Roles.type';
import { ROLES } from 'types/Roles.type';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

export interface User {
    salary: number | null;
    monthlyTakeHome: number | null;
    role: UserRoles | null;
    totpEnabled: boolean | null;
}

export interface UserContextType {
    user: User | null;
    loading: boolean;
    isAuthorized: () => boolean;
    hasRole: (role: UserRoles) => boolean;
    updateUser: (updates: Partial<User>) => void;
}

// API Response Format
export const UserResponseSchema = validateAPIResponse(
    z.object({
        salary: z.number(),
        monthlytakehome: z.number(),
        role: z.enum(ROLES),
        totp_enabled: z.number().int().min(0).max(1),
    })
);
