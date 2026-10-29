import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const DonutChartSchema = z.object({
    labels: z.array(z.string()),
    dataset: z.object({
        label: z.string(),
        data: z.array(z.number()),
        backgroundColor: z.array(z.string()),
    }),
});

export const DonutChartResponseSchema = validateAPIResponse(DonutChartSchema);
