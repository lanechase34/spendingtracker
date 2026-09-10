/**
 * App is served under this basename
 */
export const BASE_PATH = '/spendingtracker';

/**
 * Seeded dev users
 */
export const NORMAL_USER = { email: 'test2@gmail.com', password: 'mypassword' };
export const ADMIN_USER = { email: 'test1@gmail.com', password: 'mypassword' };

/**
 * User with an unknown email
 */
export const UNKNOWN_USER = { email: 'no-such-user@gmail.com', password: 'wrongpassword1' };

/**
 * Matches the home route with or without a trailing slash
 */
export const HOME_URL = new RegExp(`${BASE_PATH}/?$`);
