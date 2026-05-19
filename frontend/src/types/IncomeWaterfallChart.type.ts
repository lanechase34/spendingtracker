import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const IncomeWaterfallChartSchema = z.object({
    labels: z.array(z.string()),
    values: z.array(z.number()),
});

export type IncomeWaterfallChart = z.infer<typeof IncomeWaterfallChartSchema>;
export const IncomeWaterfallChartResponseSchema = validateAPIResponse(IncomeWaterfallChartSchema);
