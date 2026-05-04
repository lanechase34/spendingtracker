# SpendingTracker API Bruno Collection

## Prerequisites

- [Bruno](https://www.usebruno.com/) installed
- Backend app running locally

## 1. Generate the OpenAPI Spec

With your app running, visit:

```
http://localhost:8082/cbswagger
```

Right-click the page -> Save As -> save as `spendingtracker.json`.

## 2. Import into Bruno

1. Open Bruno
2. Click **Import Collection** and select the `spendingtracker.json` file you just saved

Bruno will scaffold every endpoint grouped by tag with params and request bodies pre-filled.

## 3. Set Up Your Environment

1. Copy the example environment file:

    ```bash
    cp environments/local.json.example environments/local.json
    ```

    > The `baseUrl` defaults to `http://localhost:8082`. Update `environments/local.json` if yours differs.

2. Click the SpendingTracker API collection -> in the **Environments** section, click import environment, select the `local.json` file.

3. Select **local** from the environment dropdown in the top-right corner.

## 4. Add the Collection Pre-Request Script

This script runs automatically before **every** request and injects the auth and CSRF tokens into the appropriate headers - you only need to set this up once.

In Bruno, click the `...` menu on the **SpendingTracker API** collection -> **Settings** -> **Script** -> **Pre Request** and add the following script:

```javascript
const accessToken = bru.getVar('apiKey');
const csrfToken = bru.getVar('csrf_token');

if (accessToken) {
    req.setHeader('x-auth-token', accessToken);
}

if (csrfToken && req.getMethod() !== 'GET') {
    req.setHeader('x-csrf-token', csrfToken);
}
```

## 5. Add the Auth After-Response Scripts

Two requests need after-response scripts so tokens are captured automatically when you log in.

### `Auth/Login` - After Response

In Bruno, open the **Auth/Login** request -> **Script** tab -> **Post Response**:

```javascript
var response = res.getBody();
var token = response.data.access_token;

if (!token) {
    console.log('Login failed - no access_token in response');
    return;
}

bru.setVar('apiKey', token);
console.log('apiKey updated:', token);

// Automatically fetch a fresh CSRF token after login
await bru.runRequest('Auth/Generate CSRF Token');
```

### `Auth/Generate CSRF Token` — After Response

Open the **Auth/Generate CSRF Token** request -> **Script** tab -> **Post Response**:

```javascript
var response = res.getBody();
var token = response.data.csrf_token;

if (!token) {
    console.log('CSRF fetch failed - no csrf_token in response');
    return;
}

bru.setVar('csrf_token', token);
console.log('csrf_token updated:', token);
```

---

f

## 6. Authenticate

Run the **login** request once with your credentials. It will automatically:

1. Extract and store the `access_token`
2. Trigger the **Generate CSRF Token** request
3. Extract and store the `csrf_token`

From this point every request in the collection will have the correct headers injected automatically. Re-run **login** any time your token expires.

---

## Environment Variables

| Variable     | Description                                                      |
| ------------ | ---------------------------------------------------------------- |
| `baseUrl`    | API base URL e.g. `http://localhost:8082`                        |
| `apiKey`     | Populated automatically by **Login**                             |
| `csrf_token` | Populated automatically by **Login** via **Generate CSRF Token** |

## Re-importing After API Changes

The Bruno collection does not stay live-synced to `/cbswagger`. When endpoints change:

1. Visit `http://localhost:8082/cbswagger` and save the updated JSON
2. Re-import into Bruno via the collection `...` menu -> **Import**
3. Re-apply the two after-response scripts to **Login** and **Generate CSRF Token**
4. Re-apply the collection pre-request script

## Notes

- `environments/local.json` is gitignored - never commit it as it contains live tokens
- `environments/local.json.example` is the template with empty values for new devs
- The pre-request script only injects `x-csrf-token` on non-GET requests - GET requests receive only the `x-auth-token`
- Public endpoints like `/login` and `/register` will have the headers set but the API will ignore them since no auth is required

# SpendingTracker Swagger UI

1. Visit `http://localhost:8082/cbswaggerUI` to view interactive UI of the swagger spec.
