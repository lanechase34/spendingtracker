interface ErrorInfo {
    name: string | undefined;
    message: string | undefined;
}

/**
 * Reads the name and message from a thrown value without assuming it is an Error
 */
export function getErrorInfo(err: unknown): ErrorInfo {
    if (typeof err !== 'object' || err === null) return { name: undefined, message: undefined };

    const name = 'name' in err && typeof err.name === 'string' ? err.name : undefined;
    const message = 'message' in err && typeof err.message === 'string' ? err.message : undefined;
    return { name, message };
}
