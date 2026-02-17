import { z } from 'zod';

import { AuditSchema } from './Audit.type';

export const AuditLogSchema = z.object({
    audits: z.array(AuditSchema),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;
