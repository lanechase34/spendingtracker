import { z } from 'zod';
import { BugSchema } from './Bug.type';

export const BugLogSchema = z.object({
    bugs: z.array(BugSchema),
});

export type BugLog = z.infer<typeof BugLogSchema>;
