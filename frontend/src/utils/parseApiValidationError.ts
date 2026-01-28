/**
 * Parses incoming API Validation Error in the format of
 * 'Invalid Parameters. ${error1}; ${error2}; etc..'
 */
export function parseApiValidationError(message: string): string[] {
    if (!message) return [];

    // Remove leading "Invalid Parameters." if present
    const cleaned = message.replace(/^Invalid Parameters\.\s*/i, '');

    return cleaned
        .split(';')
        .map((part: string) => part.trim())
        .filter(Boolean) // remove empty whitespace
        .map((part: string) =>
            part.replace(/^The\s+'(.+?)'\s+value\s+is\s+/i, (_, field: string) => {
                // Convert camelCase to "Title Case"
                const prettyField = field.replace(/([A-Z])/g, ' $1').replace(/^./, (c: string) => c.toUpperCase());
                return `${prettyField} `;
            })
        );
}
