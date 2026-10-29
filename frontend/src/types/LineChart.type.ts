import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const LineChartSchema = z.object({
    labels: z.array(z.string()),
    dataset: z.object({
        label: z.string(),
        data: z.array(z.number().nullable()),
    }),
});

export const LineChartResponseSchema = validateAPIResponse(LineChartSchema);
