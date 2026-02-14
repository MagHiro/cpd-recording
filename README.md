# Recording Vault (Next.js 16)

Secure video stream platform for paid recordings and materials.

## What This App Delivers

- Google Drive assets are streamed/downloaded through server-side proxy routes.
- Browser never receives raw Google Drive URLs.
- Staff creates reusable video catalog entries from protected `/admin` panel.
- n8n sends signed webhook with `email + videoIds` to assign purchased videos.
- Access is bound to booking email via one-time login code.
- If the same email books again, new package is appended to the same vault.

## Stack

- Next.js 16 (App Router)
- TypeScript
- PostgreSQL (`pg`)
- Zod validation
- Google Drive OAuth 2.0 (refresh token)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
```

Required admin variables:
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_COOKIE_NAME`
- `ADMIN_SESSION_TTL_HOURS`

Required database variables:
- `DATABASE_URL` (recommended for local Postgres)
- `POSTGRES_URL` (works for pooled or direct provider URLs)
- `POSTGRES_URL_NON_POOLING` (optional direct fallback)

Required Google Drive variables:
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_DRIVE_SCOPES`

Optional:
- `GOOGLE_OAUTH_REFRESH_TOKEN` (if you already have one)
- `GOOGLE_DRIVE_CONNECT_REDIRECT_URI` (defaults to `${APP_URL}/api/admin/google/connect/callback`)

3. Run development server:

```bash
npm run dev
```

4. Connect Google Drive from admin:
- Open `/admin/login` and sign in as admin.
- Open `/admin` and click `Connect Drive`.
- Complete Google consent screen.
- On success, refresh token is stored securely in app settings.

## Security Model

- Session cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Login code is stored hashed (never plaintext).
- n8n webhook uses HMAC SHA-256 signature:
  - Headers required: `x-n8n-signature`, `x-n8n-timestamp`
  - Signature is `hex(HMAC_SHA256(secret, timestamp))`
  - Timestamp drift is enforced (`N8N_TIMESTAMP_TOLERANCE_SECONDS`).
- Video and material routes check authenticated user ownership before proxying file bytes.
- Video streaming additionally requires a short-lived signed stream token bound to user session fingerprint (IP + user-agent).
- Basic in-memory rate limiting is applied to auth and webhook routes.

## API Usage

Base URL (local): `http://localhost:3000`

### 1. User Auth API

#### `POST /api/auth/request-code`
Request an OTP code for a provisioned email.

Request:
```json
{
  "email": "user@example.com"
}
```

Response (`200`):
```json
{
  "success": true,
  "message": "If your account exists, a login code has been sent."
}
```

Notes:
- If email is not provisioned, response is still success (no information leak).
- In development with no SMTP, codes are logged to terminal.

#### `POST /api/auth/verify-code`
Verify OTP and create session cookie.

Request:
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

Response (`200`):
```json
{
  "success": true
}
```

#### `POST /api/auth/logout`
Clear user session.

Response (`200`):
```json
{
  "success": true
}
```

### 2. Admin Auth API

#### `POST /api/admin/auth/login`
Admin login (sets admin session cookie).

Request:
```json
{
  "email": "admin@example.com",
  "password": "your-admin-password"
}
```

Response (`200`):
```json
{
  "success": true
}
```

#### `POST /api/admin/auth/logout`
Clear admin session.

Response (`200`):
```json
{
  "success": true
}
```

### 3. Admin Catalog API (requires admin session cookie)

#### `GET /api/admin/entries`
List catalog entries.

Response (`200`):
```json
{
  "success": true,
  "items": [
    {
      "videoId": "CF1-2026-02-10",
      "classCode": "CF1",
      "classTitle": "Class Title"
    }
  ]
}
```

#### `POST /api/admin/entries`
Create or update a catalog video entry.

Request:
```json
{
  "videoId": "CF1-2026-02-10",
  "classCode": "CF1",
  "classTitle": "NZ Visa System",
  "classDate": "2026-02-10 03:00:00",
  "classPrice": 35,
  "recording": {
    "title": "CF1 Recording",
    "kind": "VIDEO",
    "googleDriveFileId": "1AbcDef...",
    "mimeType": "video/mp4"
  },
  "materials": [
    {
      "title": "Slides",
      "kind": "PDF",
      "googleDriveFileId": "1PdfId...",
      "mimeType": "application/pdf"
    },
    {
      "title": "Source Files",
      "kind": "ZIP",
      "googleDriveFileId": "1ZipId...",
      "mimeType": "application/zip"
    }
  ]
}
```

Response (`200`):
```json
{
  "success": true,
  "videoId": "CF1-2026-02-10",
  "classCode": "CF1",
  "classTitle": "NZ Visa System",
  "message": "Catalog entry saved."
}
```

### 4. Admin Drive Connect API (requires admin session cookie)

#### `GET /api/admin/google/connect/start`
Starts OAuth flow and redirects admin to Google consent screen.

#### `GET /api/admin/google/connect/callback`
OAuth callback endpoint. Exchanges code and stores refresh token.

#### `GET /api/admin/google/connect/status`
Read Drive connection status.

Response (`200`):
```json
{
  "success": true,
  "drive": {
    "hasStoredRefreshToken": true,
    "connectedEmail": "admin@example.com",
    "connectedAt": "2026-02-12T09:00:00.000Z"
  }
}
```

### 5. n8n Provisioning API

#### `POST /api/n8n/provision-vault`
Assign catalog videos to a user by email.

Required headers:
- `x-n8n-timestamp`: unix seconds
- `x-n8n-signature`: `hex(HMAC_SHA256(secret, timestamp))`
- `content-type: application/json`

Primary request format:
```json
{
  "email": "user@example.com",
  "requestId": "booking-123",
  "videoIds": ["CF1-2026-02-10", "CF2-2026-02-17"]
}
```

Also accepted:
- `videoId` (single string)
- `video_ids` (array)
- legacy direct-asset payload (`packageTitle` + `recordings/materials`)
- legacy `booked_class` payload

Success response (`200`):
```json
{
  "success": true,
  "email": "user@example.com",
  "vaultLink": "http://localhost:3000/vault",
  "totalPackages": 2,
  "packages": [
    {
      "videoId": "CF1-2026-02-10",
      "packageId": "...",
      "totalAssets": 3
    }
  ]
}
```

Missing catalog IDs (`400`):
```json
{
  "error": "Some videoIds are not found in catalog.",
  "missingVideoIds": ["CF9-UNKNOWN"]
}
```

### 6. Protected Media APIs (requires user session cookie)

#### `GET /api/stream/:assetId`
Stream video bytes.

#### `GET /api/material/:assetId`
Serve PDF/ZIP material bytes.

If user does not own the asset: `401/404`.

## n8n Signature Example (PowerShell)

```powershell
$secret = "your-n8n-webhook-secret"
$timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$obj = @{
  email = "user@example.com"
  requestId = "booking-123"
  videoIds = @("CF1-2026-02-10")
}
$body = $obj | ConvertTo-Json -Depth 10 -Compress

$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$signatureBytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$timestamp"))
$signature = -join ($signatureBytes | ForEach-Object { $_.ToString("x2") })

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/n8n/provision-vault" `
  -Headers @{ "x-n8n-timestamp" = "$timestamp"; "x-n8n-signature" = "$signature"; "Content-Type" = "application/json" } `
  -Body $body
```

## User Authentication

- One-time code login by provisioned booking email.

## Staff Admin Panel

- Admin login: `/admin/login`
- Admin dashboard: `/admin`
- Create reusable catalog entries with:
  - unique `videoId`
  - class metadata (`classCode`, `classTitle`, `classDate`, `classPrice`)
  - video Google Drive file ID
  - optional material Google Drive file IDs (PDF/ZIP)

## Important Limitation

This implementation strongly reduces casual downloading (no direct Drive links, no download button in player), but browser-delivered media can never be made 100% non-downloadable without enterprise DRM (Widevine/FairPlay/PlayReady + encrypted packaging).

For stricter content protection, integrate DRM-capable streaming infrastructure.
