import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const StackedExpenseChartSchema = z.object({
    labels: z.array(z.string()),
    datasets: z.array(
        z.object({
            label: z.string(),
            data: z.array(z.number().nullable()),
            backgroundColor: z.string(),
        })
    ),
});

export const StackedExpenseChartResponseSchema = validateAPIResponse(StackedExpenseChartSchema);
