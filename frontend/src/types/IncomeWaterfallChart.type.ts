import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const SegmentSchema = z.object({
    net: z.number(),
    savings: z.number(),
    runningTotal: z.number(),
});

const IncomeWaterfallChartSchema = z.object({
    labels: z.array(z.string()),
    segments: z.array(SegmentSchema),
});

export type IncomeWaterfallChart = z.infer<typeof IncomeWaterfallChartSchema>;
export const IncomeWaterfallChartResponseSchema = validateAPIResponse(IncomeWaterfallChartSchema);
