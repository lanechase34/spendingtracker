# Bruno API Collection

## Setup

1. Copy the example environment file:

    ```bash
    cp environments/local.yml.example environments/local.yml
    ```

2. Open Bruno and click **Open Collection**, navigate to this `bruno/` folder

3. Select **local** as the active environment in the top-right environment dropdown

    > The `base_url` defaults to `http://localhost:8082`. Update `environments/local.yml` if yours differs.

## Authentication

Run the **`/login`** request first - it will automatically:

1. Store the `access_token` in your environment
2. Fire the `/csrf` request and store the `csrf_token`

All other requests use these tokens via the `x-auth-token` and `x-csrf-token` headers automatically. You just need to re-run `/login` each time you open Bruno.

## Environment Variables

| Variable       | Description                                     |
| -------------- | ----------------------------------------------- |
| `base_url`     | API base URL                                    |
| `access_token` | Populated automatically by `/login`             |
| `csrf_token`   | Populated automatically by `/login` via `/csrf` |

## Notes

- `environments/local.yml` is gitignored - never commit it as it contains live tokens
- `environments/local.yml.example` is the template with empty values for new devs
