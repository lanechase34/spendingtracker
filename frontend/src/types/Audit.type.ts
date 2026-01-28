import { z } from 'zod';

export const AuditSchema = z.object({
    id: z.number().int().positive(),
    created: z.string(),
    ip: z.string(),
    urlpath: z.string(),
    method: z.string(),
    agent: z.string(),
    detail: z.string(),
    statuscode: z.number().int(),
    delta: z.number(),
    email: z.string().optional(),
});

export type Audit = z.infer<typeof AuditSchema>;
