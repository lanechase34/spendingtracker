import { z } from 'zod';

export const BugSchema = z.object({
    id: z.number().int().positive(),
    created: z.string(),
    ip: z.string(),
    urlpath: z.string(),
    method: z.string(),
    agent: z.string(),
    detail: z.string(),
    stack: z.string(),
    email: z.string().optional(),
});

export type Bug = z.infer<typeof BugSchema>;
