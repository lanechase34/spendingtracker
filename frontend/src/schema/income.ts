import type useAuthFetch from 'hooks/useAuthFetch';
import {
    type Income,
    type IncomeExtra,
    IncomeExtraListResponseSchema,
    IncomeResponseSchema,
    type SaveIncomeExtraBody,
    SaveIncomeExtraResponseSchema,
    type UpdateIncomeBody,
} from 'types/Income.type';
import { API_BASE_URL } from 'utils/constants';
import { safeJson } from 'utils/safeJson';
import { NoDataAPIResponseSchema } from 'validators/validateAPIResponse';

/**
 * Service layer for income API
 */
export function incomeService(authFetch: ReturnType<typeof useAuthFetch>) {
    return {
        /**
         * GET /income
         * View pay and extra income totals for the full months spanning start and end dates
         *
         * @rc.startDate income in range from start - end
         * @rc.endDate   end
         */
        async fetchIncome(queryString: string, signal?: AbortSignal): Promise<Income> {
            const response = await authFetch({
                url: `${API_BASE_URL}/income?${queryString}`,
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
            const parsed = IncomeResponseSchema.safeParse(json);
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
         * PUT /income
         * Save (upsert) the monthly pay record for date (YYYY-MM)
         *
         * @rc.date the YYYY-MM for income record
         * @rc.pay  numeric pay
         */
        async updateIncome(body: UpdateIncomeBody) {
            const response = await authFetch({
                url: `${API_BASE_URL}/income`,
                method: 'PUT',
                body,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }

            if (!response.ok) {
                throw new Error('Error updating income. Please try again.');
            }

            const parsed = NoDataAPIResponseSchema.safeParse(await safeJson(response));
            if (parsed.success && parsed.data.error) {
                throw new Error('Error updating income. Please try again.');
            }

            return;
        },

        /**
         * GET /income/extra
         * View each extra income entry for the full months spanning start and end dates, newest first
         *
         * @rc.startDate extra income in range from start - end
         * @rc.endDate   end
         */
        async fetchExtraIncome(queryString: string, signal?: AbortSignal): Promise<IncomeExtra[]> {
            const response = await authFetch({
                url: `${API_BASE_URL}/income/extra?${queryString}`,
                method: 'GET',
                signal: signal,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }

            if (!response.ok) {
                throw new Error('Error Retrieving Extra Income. Please try again.');
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = IncomeExtraListResponseSchema.safeParse(json);
            if (!parsed.success) {
                throw new Error('Extra Income Validation failed: Invalid response format');
            }

            // Check errors
            const result = parsed.data;
            if (result.error) {
                throw new Error('Error Retrieving Extra Income. Please try again.');
            }

            return result.data;
        },

        /**
         * POST /income/extra
         * Save a new extra income entry
         *
         * @rc.date        the date the extra income was received
         * @rc.amount      numeric amount
         * @rc.description description of the extra income
         *
         * @return the new entry's id
         */
        async saveExtraIncome(body: SaveIncomeExtraBody): Promise<number> {
            const response = await authFetch({
                url: `${API_BASE_URL}/income/extra`,
                method: 'POST',
                body,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }

            if (!response.ok) {
                throw new Error('Error saving extra income. Please try again.');
            }

            const json = await safeJson(response);
            const parsed = SaveIncomeExtraResponseSchema.safeParse(json);
            if (!parsed.success) {
                throw new Error('Extra Income Validation failed: Invalid response format');
            }

            const result = parsed.data;
            if (result.error) {
                throw new Error('Error saving extra income. Please try again.');
            }

            return result.data.id;
        },

        /**
         * DELETE /income/extra/{id}
         * Delete an extra income entry
         *
         * @rc.id pk of extra income entry
         */
        async deleteExtraIncome(id: number, signal?: AbortSignal) {
            const response = await authFetch({
                url: `${API_BASE_URL}/income/extra/${String(id)}`,
                method: 'DELETE',
                signal: signal,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }

            if (!response.ok) {
                throw new Error('Error deleting extra income. Please try again.');
            }

            const parsed = NoDataAPIResponseSchema.safeParse(await safeJson(response));
            if (parsed.success && parsed.data.error) {
                throw new Error('Error deleting extra income. Please try again.');
            }

            return;
        },
    };
}
