import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

export const TaskRecordSchema = z.object({
    name: z.string(),
    created: z.string(),
    module: z.string(),
    executor: z.string(),
    lastRun: z.string(),
    nextRun: z.string(),
    totalFailures: z.number(),
    totalSuccess: z.number(),
    totalRuns: z.number(),
    lastExecutionTime: z.number(),
    error: z.boolean(),
    errorMessage: z.string(),
    scheduled: z.boolean(),
});

export const TaskResponseSchema = validateAPIResponse(z.array(TaskRecordSchema));

export type TaskRecord = z.infer<typeof TaskRecordSchema>;
export type TaskResponse = z.infer<typeof TaskResponseSchema>;
