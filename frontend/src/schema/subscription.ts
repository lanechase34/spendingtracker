import useAuthFetch from 'hooks/useAuthFetch';
import type { Subscription } from 'types/Subscription.type';
import { safeJson } from 'utils/safeJson';
import { validateAPIResponse } from 'validators/validateAPIResponse';
import { z } from 'zod';

const NoDataAPIResponseSchema = validateAPIResponse(z.null().optional());
const ToggleSubscriptionAPISchema = validateAPIResponse(
    z.object({
        nextDate: z.string().datetime({ local: true }),
    })
);
/**
 * Service layer for the Subscription API endpoints
 */
export function subscriptionService(authFetch: ReturnType<typeof useAuthFetch>) {
    return {
        /**
         * PATCH /subscriptions/{id}
         * Toggle a subscription's active status
         *
         * @rc.id     pk of subscription
         * @rc.active t/f
         */
        async toggleSubscription(row: Subscription, signal?: AbortSignal) {
            const response = await authFetch({
                url: `/spendingtracker/api/v1/subscriptions/${row.id}/active/${!row.active}`,
                method: 'PATCH',
                signal: signal,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }
            if (!response.ok) {
                throw new Error('Invalid network response');
            }

            // Validate the response data
            const json = await safeJson(response);
            const parsed = ToggleSubscriptionAPISchema.safeParse(json);
            if (!parsed.success) {
                throw new Error('Toggle Validation failed: Invalid response format');
            }

            // Check errors
            if (parsed.data?.error ?? false) {
                throw new Error('Error toggling subscription. Please try again in a few minutes.');
            }
        },

        /**
         * DELETE /subscriptions/{id}
         * Delete a subscription
         *
         * @rc.id pk of subscription
         */
        async deleteSubscription(subscriptionId: number, signal?: AbortSignal) {
            const response = await authFetch({
                url: `/spendingtracker/api/v1/subscriptions/${subscriptionId}`,
                method: 'DELETE',
                signal: signal,
            });

            if (!response) {
                throw new Error('User not authenticated');
            }
            if (!response.ok) {
                throw new Error('Invalid network response');
            }

            const json = await safeJson(response);
            const parsed = NoDataAPIResponseSchema.safeParse(json);
            if (!parsed.success) {
                throw new Error('Delete Validation failed: Invalid response format');
            }

            // Check errors
            if (parsed.data?.error ?? false) {
                throw new Error('Error toggling subscription. Please try again in a few minutes.');
            }
        },
    };
}
