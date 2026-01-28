import { z } from 'zod';

/**
 * Generic validator for the API Response
 * The schema passed in is used to validate the data key
 */
export const validateAPIResponse = <T extends z.ZodTypeAny>(schema: T) => {
    return z.discriminatedUnion('error', [
        z.object({
            error: z.literal(false),
            data: schema,
            messages: z.array(z.string()).optional(),
            pagination: z
                .object({
                    page: z.number(),
                    offset: z.number(),
                    totalRecords: z.number(),
                    filteredRecords: z.number().optional(),
                    totalPages: z.number(),
                })
                .optional(),
        }),
        z.object({
            error: z.literal(true),
            data: z.undefined().optional(),
            messages: z.array(z.string()),
            pagination: z.undefined().optional(),
        }),
    ]);
};
