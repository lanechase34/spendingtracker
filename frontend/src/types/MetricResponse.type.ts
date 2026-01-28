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

export const MetricSchema = z.object({
    cpu: z.object({
        cores: z.number(),
        processPercent: z.number(),
        systemPercent: z.number(),
    }),
    memory: z.object({
        totalMB: z.number(),
        usedMB: z.number(),
        maxMB: z.number(),
    }),
    concurrency: z.object({
        activeRequests: z.number(),
        maxRequests: z.number(),
        slowRequests: z.array(SlowRequestSchema),
    }),
});

export const MetricResponseSchema = validateAPIResponse(MetricSchema);

export type Metric = z.infer<typeof MetricSchema>;
export type MetricResponse = z.infer<typeof MetricResponseSchema>;
export type SlowRequest = z.infer<typeof SlowRequestSchema>;
