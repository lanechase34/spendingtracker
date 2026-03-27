import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const HeatMapSchema = z.record(z.string(), z.number());

export type HeatMap = z.infer<typeof HeatMapSchema>;
export const HeatMapResponseSchema = validateAPIResponse(HeatMapSchema);
