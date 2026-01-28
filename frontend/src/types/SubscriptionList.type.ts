import { z } from 'zod';
import { SubscriptionSchema } from './Subscription.type';

export const SubscriptionListSchema = z.object({
    subscriptions: z.array(SubscriptionSchema),
    filteredSum: z.number().nonnegative(),
    totalSum: z.number().nonnegative(),
});

export type SubscriptionList = z.infer<typeof SubscriptionListSchema>;
