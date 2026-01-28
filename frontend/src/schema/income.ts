import { z } from 'zod';
import useAuthFetch from 'hooks/useAuthFetch';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import type { APIResponseType } from 'types/APIResponse.type';
import { safeJson } from 'utils/safeJson';

/**
 * API Return Format
 */
const IncomeSchema = z.object({
    pay: z.number().nonnegative(),
    extra: z.number().nonnegative(),
});

export type Income = z.infer<typeof IncomeSchema>;

const APIResponseSchema = validateAPIResponse(IncomeSchema);

/**
 * Service layer for income API
 */
export function incomeService(authFetch: ReturnType<typeof useAuthFetch>) {
    return {
        /**
         * GET /spendingtracker/api/v1/income
         * View income between start and end dates
         *
         * @rc.startDate income in range from start - end
         * @rc.endDate   end
         */
        async fetchIncome(queryString: string, signal?: AbortSignal): Promise<Income> {
            const response = await authFetch({
                url: `/spendingtracker/api/v1/income?${queryString}`,
                method: 'GET',
                signal: signal,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }

            if (!response.ok) {
                throw new Error('Error Retrieving Income. Please try again.');
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = APIResponseSchema.safeParse(json);
            if (!parsed.success) {
                throw new Error('Income Validation failed: Invalid response format');
            }

            // Check errors
            const result = parsed.data;
            if (result.error) {
                throw new Error('Error Retrieving Income. Please try again.');
            }

            return result.data;
        },

        /**
         * PUT /spendingtracker/api/v1/income
         * Save (upsert) income record for date (YYYY-MM)
         *
         * @rc.date  the YYYY-MM for income record
         * @rc.pay   numeric pay
         * @rc.extra numeric extra
         */
        async updateIncome(body: { date: string; pay: string; extra: string }) {
            const response = await authFetch({
                url: '/spendingtracker/api/v1/income',
                method: 'PUT',
                body,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }

            if (!response.ok) {
                const result = (await response.json()) as APIResponseType<null>;
                if (result?.error ?? true) {
                    throw new Error('Error updating income. Please try again.');
                }
            }

            return;
        },
    };
}
