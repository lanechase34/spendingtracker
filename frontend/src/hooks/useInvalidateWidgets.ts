import { useQueryClient } from '@tanstack/react-query';
import { WIDGET_KEYS } from 'utils/queryKeys';
import { useCallback } from 'react';

/**
 * Hook to invalidate all the widget queries forcing a refresh of each one
 */
export function useInvalidateWidgets() {
    const queryClient = useQueryClient();

    return useCallback(() => {
        WIDGET_KEYS.forEach((key) => {
            void queryClient.invalidateQueries({ queryKey: [key] });
        });
    }, [queryClient]);
}
