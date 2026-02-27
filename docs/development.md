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

1. Format all ts, tsx files using Prettier by running

    ```
    npm run format
    ```

### Backend

1. Format all `*.cfc` files by running this in box

    ```
    run-script format
    ```

## Code Linting

### Frontend

1. Make sure vscode can resolve `eslint.config.ts`
2. Check for lint errors by running

    ```
    npm run lint
    ```

### Backend

1. Lint cfc using CFLint by running in box
    ```
    run-script lint
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

## Testing GitHub Actions Locally

GitHub Actions workflows can be run locally using [act](https://github.com/nektos/act), which simulates the GitHub Actions runner environment via Docker.

### Prerequisites

- Docker running locally
- `act` installed
- The `ubuntu-24.04` runner image pulled:

    ```bash
    docker pull ghcr.io/catthehacker/ubuntu:act-24.04
    ```

### Running the Workflows

You can run the test workflows from the VS Code Tasks menu (`Terminal > Run Task`) or directly from the terminal at the project root:

```bash
# Backend
act -W '.github/workflows/test-backend.yml' -P ubuntu-24.04=ghcr.io/catthehacker/ubuntu:act-24.04 --rm --pull=false

# Frontend
act -W '.github/workflows/test-frontend.yml' -P ubuntu-24.04=ghcr.io/catthehacker/ubuntu:act-24.04 --rm --pull=false
```

Note: The `--pull=false` flag prevents `act` from re-pulling the runner image each run. If the container image is missing or outdated, remove this flag to pull a fresh copy.

## Dev Setup (No Docker)

### Prerequisites

- Node.js and npm
- CommandBox CLI
- PostgreSQL

### Frontend

1. All commands assume /frontend

    ```
    cd /frontend
    ```

2. Install latest version of Node and verify installation

    ```
    node -v
    ```

3. Install dependencies

    ```
    npm install
    ```

4. Start the Vite dev server

    ```
    npm start
    ```

5. Frontend will be running at
    ```
    http://localhost:3000
    ```

### Backend

1. All commands assume /backend

    ```
    cd /backend
    ```

2. Install and run commandbox with `box`

3. Setup Git Hooks by running

    ```
    githooks install
    ```

4. Install modules using

    ```
    install
    ```

5. Create PostgreSQL database with user

6. Generate and populate a development `.env` file

    ```
    run-script blankEnv
    ```

7. Create the database tables and seed with dev data

    ```
    migrate install
    migrate up
    migrate seed run
    ```

8. Start server

    ```
    server start
    ```

9. Backend will be running at
    ```
    http://localhost:8082
    ```
