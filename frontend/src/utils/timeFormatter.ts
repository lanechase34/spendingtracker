/**
 * Format number of incoming seconds to minutes:seconds time
 */
export function formatSecondsToTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to human readable
 */
export const formatMinutesToTime = (minutes: number): string => {
    const seconds = minutes * 60;
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
};
