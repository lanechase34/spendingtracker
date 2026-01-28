const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Validate the textField is an email
 */
export const validateEmail = (value: string | null): string | null => {
    if (!value || value.trim() === '') return 'Field is required';
    if (!pattern.test(value)) return 'Not a valid email';
    return null;
};
