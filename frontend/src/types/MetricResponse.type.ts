import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const SlowRequestSchema = z.object({
    delta: z.number(),
    method: z.string(),
    urlpath: z.string(),
    userid: z.number(),
    time: z.string(),
    uuid: z.string(),
});

const SlowQuerySchema = z.object({
    sql: z.string(),
    ms: z.number(),
    time: z.string(),
    uuid: z.string(),
});

const MetricSchema = z.object({
    uptimeMs: z.number(),
    cpu: z.object({
        cores: z.number(),
        processPercent: z.number().nullish(),
        systemPercent: z.number().nullish(),
    }),
    memory: z.object({
        totalMB: z.number(),
        usedMB: z.number(),
        maxMB: z.number(),
    }),
    threads: z.object({
        live: z.number(),
        peak: z.number(),
        daemon: z.number(),
        deadlocked: z.number(),
    }),
    gc: z.object({
        totalMs: z.number(),
        deltaMs: z.number(),
        percent: z.number(),
    }),
    concurrency: z.object({
        activeRequests: z.number(),
        maxRequests: z.number(),
        slowRequests: z.array(SlowRequestSchema),
    }),
    queries: z.object({
        count: z.number(),
        errors: z.number(),
        avgMs: z.number(),
        maxMs: z.number(),
        peak: z.number(),
        total: z.number(),
        slowQueries: z.array(SlowQuerySchema),
    }),
    database: z.object({
        up: z.boolean(),
        pingMs: z.number().nullish(),
        connections: z
            .object({
                total: z.number(),
                active: z.number(),
                idle: z.number(),
                idleInTransaction: z.number(),
                waitingOnLock: z.number(),
                max: z.number(),
            })
            .nullish(),
        longestQuerySeconds: z.number(),
    }),
    rateLimit: z.object({
        blocked: z.number(),
        total: z.number(),
        byEvent: z.record(z.string(), z.number()),
    }),
});

export const MetricResponseSchema = validateAPIResponse(MetricSchema);

export type Metric = z.infer<typeof MetricSchema>;
export type SlowRequest = z.infer<typeof SlowRequestSchema>;
export type SlowQuery = z.infer<typeof SlowQuerySchema>;
