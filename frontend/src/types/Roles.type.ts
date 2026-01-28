export const ROLES = {
    USER: 'USER',
    ADMIN: 'ADMIN',
} as const;

export type UserRoles = (typeof ROLES)[keyof typeof ROLES];
