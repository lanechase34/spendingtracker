# Development Guide

This document covers developer workflows including dependency updates, formatting, and testing for both frontend and backend services.

## Updates

### Box Updates

1. Check for updates

    ```
    box update
    ```

2. Review and confirm updates to `box.json` when prompted
3. Restart server
    ```
    server restart
    ```

### NPM Updates

1. Check for updates

    ```
    ncu
    ```

2. Update `package.json` file

    ```
    ncu -u
    ```

3. Install new packages

    ```
    npm install
    ```

4. (Optional) Run audit fixes
    ```
    npm audit fix
    ```

## Code Formatting

### Frontend

1. Make sure vscode can resolve `eslint.config.ts`
2. Check for lint errors by running

    ```
    npm run lint
    ```

### Backend

1. Format all `*.cfc` files by running this in box

    ```
    run-script format
    ```

## Testing

### Frontend

1. Run Jest Suite using vscode extension or running

    ```
    npm run test
    ```

2. Check test coverage by running

    ```
    npm run testcoverage
    ```

### Backend

1. Run Testbox Suite via browser

    ```
    http://localhost:8082/tests/runner.cfm
    ```

## Dev Flags

### Backend

The following `.env` variables are available to assist during development

| Variable         | Description                                 |
| ---------------- | ------------------------------------------- |
| `IMPERSONATION`  | Allows logging in without a valid password  |
| `DEBUGGING`      | Enables `writeDump()` on errors             |
| `USERATELIMITER` | Toggles the request rate limiter            |
| `LOGQUERIES`     | Logs database queries to `stuploads/q.html` |
| `LOGREQUESTS`    | Logs incoming requests to the audit table   |

## Dev Environment

### Seeded Users

The following users are created and available to use for dev

| Email           | Security Level |
| --------------- | -------------- |
| test1@gmail.com | Admin          |
| test2@gmail.com | User           |
| test3@gmail.com | User           |
| test4@gmail.com | User           |
| test5@gmail.com | User           |
| test6@gmail.com | User           |
| test7@gmail.com | Unverified     |
| test8@gmail.com | Unverified     |
