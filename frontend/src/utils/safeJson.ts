/**
 * Handle malformed JSON packets or empty 204 responses
 */
export async function safeJson(response: Response): Promise<unknown> {
    try {
        return await response.json();
    } catch {
        return null; // allow empty / invalid JSON
    }
}
