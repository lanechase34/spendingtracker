import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const DiskSchema = z.object({
    name: z.string(),
    path: z.string(),
    totalMB: z.number(),
    freeMB: z.number(),
    usedPercent: z.number(),
});

const TableStatSchema = z.object({
    name: z.string(),
    liveRows: z.number(),
    deadRows: z.number(),
    seqScan: z.number(),
    idxScan: z.number(),
    sizeMB: z.number(),
    lastVacuum: z.string().nullish(),
    lastAnalyze: z.string().nullish(),
});

const StatementSchema = z.object({
    query: z.string(),
    calls: z.number(),
    totalMs: z.number(),
    meanMs: z.number(),
    maxMs: z.number(),
    rows: z.number(),
});

const DiagnosticsSchema = z.object({
    generatedAt: z.string(),
    app: z.object({
        name: z.string(),
        version: z.string(),
        environment: z.string(),
        startedAt: z.number(),
        lucee: z.string(),
        java: z.string(),
        os: z.string(),
        timezone: z.string(),
    }),
    disk: z.array(DiskSchema),
    database: z.object({
        available: z.boolean(),
        version: z.string(),
        sizeMB: z.number(),
        stats: z
            .object({
                commits: z.number(),
                rollbacks: z.number(),
                cacheHitRatio: z.number(),
                deadlocks: z.number(),
                tempFiles: z.number(),
                tempMB: z.number(),
                conflicts: z.number(),
                statsReset: z.string().nullish(),
            })
            .nullish(),
        tables: z.array(TableStatSchema),
        statements: z.object({
            available: z.boolean(),
            message: z.string(),
            rows: z.array(StatementSchema),
        }),
    }),
});

export const DiagnosticsResponseSchema = validateAPIResponse(DiagnosticsSchema);

export type Diagnostics = z.infer<typeof DiagnosticsSchema>;
export type DiskStat = z.infer<typeof DiskSchema>;
