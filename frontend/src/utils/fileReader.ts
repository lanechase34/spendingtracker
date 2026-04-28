/**
 * Formats the size of the file to human-friendly number
 * @param bytes Number of bytes
 * @returns Size in B, KB, MB, GB, whatever is applicable to the incoming size
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Returns the color of the line looking for successes/error/special messages
 * @param line The line text string
 * @param isDark If the app is in dark mode
 * @returns Colorful line
 */
export function getLineColor(line: string, isDark: boolean): string {
    const l = line.toLowerCase();
    if (l.includes('error') || l.includes('exception') || l.includes('fatal')) return isDark ? '#fca5a5' : '#b91c1c';
    if (l.includes('warn')) return isDark ? '#fcd34d' : '#92400e';
    if (l.includes('†') || l.includes('shutdown')) return isDark ? '#a78bfa' : '#6d28d9';
    if (l.includes('√') || l.includes('ready') || l.includes('started') || l.includes('success'))
        return isDark ? '#6ee7b7' : '#065f46';
    return isDark ? '#cbd5e1' : '#334155';
}
