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
| 4 | Build prompt | ✅ Done |
| 5 | Call AI (mock) | ✅ Done |
| 6 | Save conversation | ✅ Done |
| 7 | Log usage | ✅ Done |
| 8 | Return response | ✅ Done |

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

### Piece 4 — Build Prompt ✅

**File created:**
- `src/utils/promptBuilder.js` — combines all context into one text for AI

**What it does:**
1. Takes the client's `prompt` (e.g., "You are a sales assistant")
2. Takes `company_data` (e.g., { offers: "10% off" })
3. Takes `history` (previous messages)
4. Takes `userLastMessage` (what user just said)
5. Combines them into one big text block

**Example output:**
```
You are a sales assistant

Company Info:
{"offers":"10% off"}

Conversation:
Customer: Hi
Assistant: Hello!

Customer: Do you have discounts?
Reply:
```

**Test in Thunder Client:**

Same request — now response includes the built prompt:
```json
{
  "message": "Prompt built",
  "prompt": "\nYou are a helpful sales assistant\n\nCompany Info:..."
}
```

### Piece 5 — Call AI (mock) ✅

**File created:**
- `src/services/mockAI.js` — fake AI that returns a dummy reply

**What it does:**
1. Takes the prompt (the big text block from Piece 4)
2. Waits 200ms (simulates real AI delay)
3. Returns a fake reply string

**Why mock?**
- Real AI costs money per call
- While building, we test with fake responses
- Later, swap `mockAI()` with OpenAI/Claude — nothing else changes!

### Piece 6 — Save Conversation ✅

**File created:**
- `src/services/conversation.service.js` — get + save chat history

**What it does:**
1. Takes the old history + new user message + AI reply
2. Combines into one array
3. Saves to `conversations` table using upsert (update or insert)
4. Trims to last 20 messages only

**Why trim to 20?**
- AI has input limits — too much text = errors
- Saves DB space
- 20 messages = enough context for smart replies

### Piece 7 — Log Usage ✅

**File created:**
- `src/services/usage.service.js` — tracks API requests

**What it does:**
1. Inserts one row into `usage_logs` table
2. Each row = one successful request
3. Used by Piece 2 to check daily limits

**Why log AFTER success?**
- Only count requests that actually worked
- Failed requests shouldn't count against the client

### Piece 8 — Return Response ✅

**What it does:**
- Returns the AI reply to the client as JSON: `{ "reply": "..." }`

---

## 🎉 Webhook Pipeline Complete!

**The full flow now works end-to-end:**

```
Client sends POST /webhook with x-api-key
    ↓
1. Validate API key → find client in DB
2. Check is_active → check daily usage limit
3. Load conversation history
4. Build prompt (instructions + company data + history + message)
5. Call AI → get reply
6. Save conversation (user message + AI reply)
7. Log usage (for daily limit tracking)
8. Return reply to client
```

### Test the FULL pipeline:

```
POST http://localhost:3000/webhook
Header: x-api-key: sk_live_your_client_key
Body (JSON):
{
  "userId": "user_1",
  "userLastMessage": "Hi, do you have discounts?"
}
```

**Expected response:**
```json
{
  "reply": "🤖 Mock reply based on: \"\\nYou are a helpful sales assistant\\n\\nCompan...\""
}
```

**Try sending multiple messages** — the conversation will be saved and loaded each time!

---

## Step 5 — AI Layer Implementation

**Date:** 2026-05-01

### AI Layer Steps Tracker:

| # | Step | Status |
|---|------|--------|
| 1 | Create providers folder + move mock AI | ✅ Done |
| 2 | Add AI_PROVIDER to .env | ✅ Done |
| 3 | Create AI Service (orchestrator) | ✅ Done |
| 4 | Update webhook to use AI Service | ✅ Done |
| 5 | Test with mock provider | ✅ Done |
| 6 | Install axios | ✅ Done |
| 7 | Create Gemini provider | ✅ Done |
| 8 | Create AI Health Service | ✅ Done |
| 9 | Add startup health check in server.js | ✅ Done |
| 10 | Add timeout + fallback to AI Service | ✅ Done |
| 11 | Switch to Gemini and test | ✅ Done |

### Step 1 — Move Mock AI to Providers ✅

**What changed:**
- Created `src/providers/mock.provider.js` (new location)
- Updated webhook controller import → `../providers/mock.provider.js`
- Old `src/services/mockAI.js` can be deleted later

**Why move?**
- Each AI (mock, Gemini, OpenAI) is a "provider"
- All providers live in `src/providers/`
- AI Service picks which one to use

### Step 2 — Add AI_PROVIDER to .env ✅

**Added to `.env`:**
```
AI_PROVIDER=mock          # mock | gemini
NODE_ENV=development
GEMINI_API_KEY=your_gemini_key
```

**How it works:**
- `AI_PROVIDER=mock` → uses fake AI (free, for testing)
- `AI_PROVIDER=gemini` → uses real Gemini AI (costs money)
- Switch by changing one line in .env

### Step 3 — Create AI Service (Orchestrator) ✅

**File created:**
- `src/services/ai.service.js`

**What it does:**
1. Reads `AI_PROVIDER` from `.env` (default: "mock")
2. Looks up the provider function from a PROVIDERS map
3. Calls it with the prompt
4. Returns the response
5. If AI crashes → returns friendly fallback: "Hey! We'll get back to you shortly"

**How PROVIDERS map works:**
```
PROVIDERS = {
  mock: mockAI,        ← currently active
  gemini: geminiProvider  ← added later
}
```
`.env` says `AI_PROVIDER=mock` → picks `PROVIDERS["mock"]` → calls `mockAI()`

### Step 4 — Update Webhook to Use AI Service ✅

**What changed:**
- Webhook no longer imports `mockAI` directly
- Now imports `generateAIResponse` from `ai.service.js`
- Changed `await mockAI(prompt)` → `await generateAIResponse({ prompt })`

**Why this matters:**
```
BEFORE: webhook → mockAI (hardcoded)
AFTER:  webhook → AI Service → picks provider from .env
```
You never touch webhook code again to switch AI providers!

### Step 5 — Test with Mock Provider ✅

**How to verify:**
1. Restart server: `node src/server.js`
2. Hit webhook with same request as before
3. If you get `🤖 Mock reply...` → AI Service is routing to mock correctly

**What confirms it works:**
- Mock reply appears = AI Service picked `mock` from `.env`
- No code change in webhook = abstraction is working

### Step 6 — Install Axios ✅

**Command:** `npm install axios`

**Why?**
- Axios is a library for making HTTP requests
- Gemini provider needs it to call Google's API
- Like `fetch()` but with better error handling and timeout support

### Step 7 — Create Gemini Provider ✅

**File created:**
- `src/providers/gemini.provider.js`

**What it does:**
1. Takes a prompt string (same input as mockAI)
2. Sends it to Google's Gemini API via axios POST request
3. Extracts the reply text from the nested response
4. Returns the text string (same output as mockAI)

**How the API works:**
```
Your prompt → POST to Google → AI processes it → Returns reply
```

**API URL format:**
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_KEY
```

**What was also updated:**
- `src/services/ai.service.js` — added `gemini: geminiProvider` to the PROVIDERS map
- Now the AI Service knows how to call Gemini when `.env` says `AI_PROVIDER=gemini`

**Provider pattern:**
- Both `mockAI(prompt)` and `geminiProvider(prompt)` have the same signature
- Take a string in, return a string out
- The AI Service doesn't care which one it calls — they're interchangeable!

### Step 8 — Create AI Health Service ✅

**File created:**
- `src/services/aiHealth.service.js`

**What it does:**
- Tests if Gemini is actually working before you rely on it
- Caches the health result for 60 seconds (avoids spamming Google)

**Two functions:**
1. `checkGeminiHealth()` — sends "Say OK" to Gemini, returns true/false
2. `getGeminiHealth()` — returns cached result if fresh, otherwise calls checkGeminiHealth()

**Cache logic:**
```
First request (0s)  → calls Gemini → caches: healthy=true
Next request (10s)  → cache fresh → returns true (no API call!)
Next request (65s)  → cache expired → calls Gemini again
```

**Why cache?**
- Health checks cost an API call each time
- 100 users in 1 minute = 100 health checks without caching
- With caching = only 1 health check per minute

**Will be used by:**
- AI Service (runtime) — check before calling Gemini
- server.js (startup) — verify Gemini works when server starts

### Step 9 — Startup Health Check in server.js ✅

**File updated:**
- `src/server.js` — wrapped `app.listen()` inside `startServer()` async function

**What changed:**
- Before: server just started immediately with `app.listen(3000)`
- After: server runs health check FIRST, then starts listening

**Flow:**
```
Server starting...
    ↓
AI_PROVIDER = gemini?
  YES → check Gemini health
    Healthy? → ✅ continue
    Unhealthy + production? → 🛑 crash (process.exit(1))
    Unhealthy + development? → ⚠️ warn but continue
  NO (mock) → skip check
    ↓
app.listen(3000)
```

**Why `startServer()` function?**
- `app.listen()` is synchronous — can't do `await` outside a function
- We need `await checkGeminiHealth()` before starting
- The async function lets us wait for the health check

**Console output now shows:**
```
🔍 Checking Gemini connection...
✅ Gemini is healthy and ready!     (or ❌ if failed)
🚀 Server running on port 3000
📡 AI Provider: gemini
```

### Step 10 — Timeout + Fallback in AI Service ✅

**File updated:**
- `src/services/ai.service.js` — added `withTimeout()` + runtime health check

**What was added:**

**1. `withTimeout(promise, ms)` function:**
- Races AI call against a 5-second timer
- If AI responds in time → returns the response
- If AI is too slow → throws "AI Timeout" error → fallback message

```
AI takes 2 seconds, timeout is 5s → AI wins → you get the reply ✅
AI takes 8 seconds, timeout is 5s → timer wins → fallback message ⚠️
```

**2. Runtime health check for Gemini:**
- Before calling Gemini, checks `getGeminiHealth()` (cached, fast)
- If Gemini is unhealthy → skips Gemini entirely → uses mock instead
- Saves time and money (why call a broken API?)

**Error handling table:**
| Scenario | What happens |
|----------|-------------|
| Gemini healthy + responds fast | Normal AI reply ✅ |
| Gemini healthy + too slow (>5s) | Fallback message ⚠️ |
| Gemini unhealthy | Falls back to mock 🔄 |
| Gemini crashes | Fallback message ⚠️ |
| Mock fails (unlikely) | Fallback message ⚠️ |

### Step 11 — Switch to Gemini and Test ✅

**What changed:**
- `.env`: `AI_PROVIDER=mock` → `AI_PROVIDER=gemini`

**Startup test result:**
```
🔍 Checking Gemini connection...
❌ Gemini health check failed: unable to get local issuer certificate
⚠️ Continuing in dev mode with potentially broken Gemini
🚀 Server running on port 3000
📡 AI Provider: gemini
```

**Explanation:**
- Corporate network blocks HTTPS to Google → health check failed
- But NODE_ENV=development → server kept running (didn't crash)
- On mobile hotspot this will work with a real Gemini API key

**To fully test Gemini:**
1. Get API key from https://aistudio.google.com/apikey
2. Replace `your_gemini_key` in `.env` with the real key
3. Switch to mobile hotspot (corporate network blocks HTTPS)
4. Restart server → should see ✅ Gemini is healthy
5. Hit POST /webhook → should get a REAL AI response

**To switch back to mock:**
- Just change `.env`: `AI_PROVIDER=gemini` → `AI_PROVIDER=mock`
- Restart server — done!

---

## 🎉 AI Layer Complete!

**All 11 steps done. Here's the full architecture:**

```
src/
  providers/
    mock.provider.js      ← fake AI (free, testing)
    gemini.provider.js    ← real AI (Google Gemini)
  services/
    ai.service.js         ← orchestrator (picks provider, timeout, fallback)
    aiHealth.service.js   ← health checks (startup + runtime, 60s cache)
  server.js               ← startup health check before listening
```

**How switching works:**
```
.env: AI_PROVIDER=mock    → free testing, no API key needed
.env: AI_PROVIDER=gemini  → real AI, needs GEMINI_API_KEY
```

**Safety layers:**
1. Startup health check → verify AI works before accepting requests
2. Runtime health check → cached check before each Gemini call
3. 5-second timeout → don't wait forever for slow AI
4. Fallback to mock → if Gemini is unhealthy, use mock instead
5. Fallback message → if everything fails, return friendly message
