export const TIMESTAMP_FORMAT = 'MM/DD/YYYY HH:mm:ss';

/**
 * Format number of incoming seconds to minutes:seconds time
 */
export function formatSecondsToTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m)}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format duration in seconds to human readable
 */
export const formatMinutesToTime = (minutes: number): string => {
    const seconds = minutes * 60;
    if (seconds < 60) return `${String(seconds)}s`;
    if (seconds < 3600) return `${String(Math.floor(seconds / 60))}m`;
    if (seconds < 86400) return `${String(Math.floor(seconds / 3600))}h`;
    return `${String(Math.floor(seconds / 86400))}d`;
};

/**
 * Format a duration in milliseconds to a compact uptime string e.g. 3d 4h 12m
 */
export const formatUptime = (ms: number): string => {
    const totalMinutes = Math.floor(ms / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${String(days)}d ${String(hours)}h ${String(minutes)}m`;
    if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
    return `${String(minutes)}m`;
};
