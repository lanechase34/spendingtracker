# [SpendingTracker](https://chaselane.dev/spendingtracker)

A full-stack expense and subscription tracking platform designed to surface spending insights,
trends, financial clarity.

![Dashboard Preview](frontend/public/screenshots/dashboard.png)

## Features

#### Expense List

- Track date, amount, category, and receipt per expense
- View all expenses in a searchable, sortable, filterable data grid

#### Subscriptions

- Track charge interval (yearly, monthly)
- Automatically generates expenses when subscriptions are due
- Enable/disable subscriptions inline
- View upcoming charge dates

#### Analytics

- Stacked Bar Chart - Breakdown of expenses by category over time
- Donut Chart - Category breakdown of total spending

#### Income Tracking

- Compare total income (salary + extras) against total expenses
- View net surplus or deficit

#### Bulk Import

- Import multiple expenses at once using CSV files

#### Planned

- Bank and credit card API integrations

## Documentation

- Deployment: `docs/deployment.md`
- Development workflows: `docs/development.md`

## Dev Setup

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
