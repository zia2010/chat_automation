# Progress Tracker

---

## Step 1 — Project Setup & Health APIs ✅

**Date:** 2026-05-01

### Done:

- Created folder structure:
  ```
  src/
    db/
    utils/
    middleware/
    services/
    controllers/
    routes/
      admin.routes.js
      webhook.routes.js
    server.js
  .env
  package.json
  ```

- Installed dependencies: express, dotenv, @supabase/supabase-js
- Created health endpoints:
  - `GET /admin/health` → `{ status: "ok", module: "admin" }`
  - `GET /webhook/health` → `{ status: "ok", module: "webhook" }`
- Server tested and running on port 3000

### Next Steps:

- [x] Add admin auth middleware
- [x] Add DB connection (supabase.js)
- [ ] Add admin CRUD APIs
- [ ] Add webhook pipeline

---

## Step 2 — Admin Auth Middleware ✅

**Date:** 2026-05-01

### Done:

- Created `src/middleware/adminAuth.js`
  - Reads `x-admin-key` header
  - Compares against `ADMIN_SECRET` env variable
  - Returns 403 if missing or invalid
- Added test route: `GET /admin/auth-check` (protected)
- Health endpoint remains open (no auth)

### Test in Postman:

**Without key (should fail):**
```
GET http://localhost:3000/admin/auth-check
→ 403 { "error": "Forbidden" }
```

**With key (should pass):**
```
GET http://localhost:3000/admin/auth-check
Header: x-admin-key: your_super_secret_key
→ 200 { "status": "ok", "message": "Admin authenticated" }
```

---

## Step 3 — Admin CRUD APIs (in progress)

**Date:** 2026-05-01

### Done:

- [x] `POST /admin/clients` — Create a new client
- [x] `POST /admin/api-key` — Generate API key for a client

### Files created:

- `src/utils/apiKey.js` — generates random API key (sk_live_xxx)
- `src/utils/hash.js` — hashes API key with SHA-256
- `src/controllers/admin.controller.js` — createClient + generateApiKeyHandler

### Test in Thunder Client:

**1. Create a client first:**
```
POST http://localhost:3000/admin/clients
Header: x-admin-key: your_super_secret_key
Body (JSON):
{
  "name": "Demo Brand",
  "email": "demo@mail.com",
  "allowed_tokens": 1000,
  "prompt": "You are a helpful sales assistant",
  "company_data": { "offers": "10% off first order" }
}
```
→ Copy the `id` from the response

**2. Generate API key for that client:**
```
POST http://localhost:3000/admin/api-key
Header: x-admin-key: your_super_secret_key
Body (JSON):
{
  "clientId": "paste-the-id-from-step-1"
}
```
→ Returns `{ "apiKey": "sk_live_..." }` (save this! shown only once)

### Still TODO:

- [x] `PUT /admin/clients/:clientId` — Update client
- [x] `DELETE /admin/clients/:clientId` — Delete client

### Test Update Client:

**What it does:** Change a client's settings (token limit, prompt, active status)
**Requires:** client's `apiKey` in body (must match the one stored in DB)

**Allowed fields to update:** `allowed_tokens`, `prompt`, `company_data`, `is_active`
**Cannot update:** `id`, `name`, `email` (for safety)

```
PUT http://localhost:3000/admin/clients/<paste-client-id-here>
Header: x-admin-key: your_super_secret_key
Body (JSON):
{
  "apiKey": "sk_live_your_client_key_here",
  "allowed_tokens": 5000,
  "is_active": true,
  "prompt": "You are a friendly customer support agent"
}
```
→ Returns the full updated client object
→ If wrong apiKey → 401 "API key does not match this client"

---

### Test Delete Client:

**What it does:** Permanently removes a client + their conversations + usage logs
**Requires:** client's `apiKey` in body (must match the one stored in DB)

```
DELETE http://localhost:3000/admin/clients/<paste-client-id-here>
Header: x-admin-key: your_super_secret_key
Body (JSON):
{
  "apiKey": "sk_live_your_client_key_here"
}
```
→ Returns `{ "message": "Client deleted successfully" }`
→ If wrong apiKey → 401 "API key does not match this client"

⚠️ This is permanent — no undo!

---

## Step 3 — Admin CRUD APIs ✅

All 4 admin APIs complete:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /admin/clients | Create new client |
| POST | /admin/api-key | Generate API key |
| PUT | /admin/clients/:id | Update client config |
| DELETE | /admin/clients/:id | Delete client + data |

### Next Steps:

- [x] Add admin CRUD APIs
- [ ] Add webhook pipeline (client-facing AI chat)

---

## Step 4 — Webhook Pipeline (building piece by piece)

**Date:** 2026-05-01

### Webhook Pieces Tracker:

| # | Piece | Status |
|---|-------|--------|
| 1 | Validate API key | ✅ Done |
| 2 | Check active + usage | ✅ Done |
| 3 | Load conversation | ✅ Done |
| 4 | Build prompt | ⬜ |
| 5 | Call AI (mock) | ⬜ |
| 6 | Save conversation | ⬜ |
| 7 | Log usage | ⬜ |
| 8 | Return response | ⬜ |

### Piece 1 — Validate API Key ✅

**Files created:**
- `src/controllers/webhook.controller.js` — webhook handler (piece 1)

**Files updated:**
- `src/routes/webhook.routes.js` — added `POST /webhook` route

**What it does:**
1. Reads `x-api-key` from header
2. Reads `userId` + `userLastMessage` from body
3. Hashes the key with SHA-256
4. Looks up client in DB by matching hash
5. If match → client verified. If not → 401 rejected

**Test in Thunder Client:**

```
POST http://localhost:3000/webhook
Header: x-api-key: sk_live_your_client_key_here
Body (JSON):
{
  "userId": "user_1",
  "userLastMessage": "Hi there"
}
```

| Scenario | Response |
|----------|----------|
| No x-api-key header | 401 `{ "error": "Missing API key" }` |
| Wrong key | 401 `{ "error": "Invalid API key" }` |
| Correct key | 200 `{ "message": "API key valid", "clientId": "...", "clientName": "..." }` |

### Piece 2 — Check Active + Usage ✅

**What it does:**
1. Checks if `client.is_active` is true → if false → 403 "Client is disabled"
2. Counts today's usage from `usage_logs` table
3. Compares count with `client.allowed_tokens` → if over limit → 429 "Daily usage limit exceeded"

**Why do this BEFORE AI call?**
- No point calling AI (which costs money) if the client is disabled or over limit
- This saves you money by rejecting early

**How the usage count works:**
```
Get today's date → "2026-05-01"
    ↓
Count rows in usage_logs where:
  client_id = this client
  AND created_at >= today
    ↓
If count >= allowed_tokens → reject
```

**Test in Thunder Client:**

Same request as Piece 1:
```
POST http://localhost:3000/webhook
Header: x-api-key: sk_live_your_client_key_here
Body (JSON):
{
  "userId": "user_1",
  "userLastMessage": "Hi there"
}
```

| Scenario | Response |
|----------|----------|
| Client disabled (is_active=false) | 403 `{ "error": "Client is disabled" }` |
| Over daily limit | 429 `{ "error": "Daily usage limit exceeded" }` |
| Active + under limit | 200 `{ "message": "Client verified and under limit", "usageToday": 0, "limit": 1000 }` |

### Piece 3 — Load Conversation ✅

**What it does:**
1. Queries `conversations` table using `client_id` + `user_id`
2. If conversation exists → gets the `messages` array (chat history)
3. If new user (no conversation yet) → uses empty array `[]`

**Why?**
- AI needs previous messages to give context-aware replies
- Each user has their own separate conversation per client

**How it works:**
```
client_id = "abc" + user_id = "user_1"
    ↓
Look up in conversations table
    ↓
Found? → messages = [{role: "user", text: "Hi"}, ...]
Not found? → messages = []
```

**Test in Thunder Client:**

Same request:
```
POST http://localhost:3000/webhook
Header: x-api-key: sk_live_your_key
Body: { "userId": "user_1", "userLastMessage": "Hi there" }
```

Expected (new user):
```json
{
  "message": "Conversation loaded",
  "clientId": "...",
  "userId": "user_1",
  "historyLength": 0,
  "history": []
}
```
