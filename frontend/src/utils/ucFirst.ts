/**
 * Capitalize the first character of incoming string only
 */
export const ucFirst = (str: string): string => {
    if (str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
