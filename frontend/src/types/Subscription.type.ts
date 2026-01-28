import { z } from 'zod';

export const SubscriptionSchema = z.object({
    id: z.number().int().positive(),
    nextChargeDate: z.string(),
    amount: z.number().nonnegative(),
    description: z.string(),
    category: z.string(),
    interval: z.enum(['M', 'Y']),
    active: z.number().int().min(0).max(1),
});

export type Subscription = z.infer<typeof SubscriptionSchema>;
