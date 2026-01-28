import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const CacheKeySchema = z.object({
    id: z.string(),
    created: z.string(),
    expired: z.boolean(),
    hits: z.number().nonnegative(),
    key: z.string(),
    lastaccesstimeout: z.number().nonnegative(),
    lastaccessed: z.string(),
    timeout: z.number(),
});

export const CacheSchema = z.object({
    lastReapDateTime: z.string(),
    hits: z.number().nonnegative(),
    misses: z.number().nonnegative(),
    evictionCount: z.number().nonnegative(),
    garbageCollections: z.number().nonnegative(),
    maxObjects: z.number().nonnegative(),
    data: z.array(CacheKeySchema),
});

export const CacheResponseSchema = validateAPIResponse(CacheSchema);

export type CacheKey = z.infer<typeof CacheKeySchema>;
export type CacheData = z.infer<typeof CacheSchema>;
export type CacheResponse = z.infer<typeof CacheResponseSchema>;
