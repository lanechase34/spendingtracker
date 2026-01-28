import { z } from 'zod';

export const UserRecordSchema = z.object({
    id: z.number(),
    email: z.string(),
    security_level: z.string(),
    verified: z.boolean(),
    lastlogin: z.string().nullable(),
});

export const UserListSchema = z.object({
    users: z.array(UserRecordSchema),
});

/**
 * TypeScript types derived from schemas
 */
export type UserRecord = z.infer<typeof UserRecordSchema>;
export type UserList = z.infer<typeof UserListSchema>;
