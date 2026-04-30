Good—this is a solid flow. I’ll refine it into a **clean, implementation-ready spec** with a few important fixes so it doesn’t break in real usage.

---

# 📄 Client Webhook Flow — Final (Refined)

## ✅ Final Sequence

```text
1. Validate API key
2. Fetch client from DB
3. Check client is_active
4. Check usage limit
5. Fetch prompt + company data + load conversation
6. Build prompt
7. Call AI (mock/real)
8. Append messages
9. Save conversation
10. Log usage
11. Return response
```

---

# ⚠️ Important Improvements (Don’t Skip)

### 🔴 Fix 1 — Usage check BEFORE heavy work

You already did this right 👍
👉 Keep usage check early to avoid wasting AI calls

---

### 🔴 Fix 2 — Combine DB reads (performance)

Instead of:

* fetch client
* fetch prompt
* fetch conversation

👉 Do:

```text
Fetch client (includes prompt + company_data)
Fetch conversation separately
```

---

### 🔴 Fix 3 — Always derive client from API key

```text
apiKey → hash → find client → client.id
```

👉 Never trust external clientId

---

### 🔴 Fix 4 — Trim conversation

Before saving:

```text
keep only last 20 messages
```

👉 Prevent DB + AI overload

---

# 🧠 Step-by-Step Explanation

---

## 1. Validate API Key

* Read `x-api-key` header
* Hash it
* Match with `api_key_hash` in DB

❌ If not found → reject immediately

---

## 2. Fetch Client

Get:

* id
* allowed_tokens
* prompt
* company_data
* is_active

---

## 3. Check is_active

If false:

→ reject request

---

## 4. Check Usage Limit

Query usage_logs:

count where:

* client_id = client.id
* created_at = today

If:

count >= allowed_tokens

→ reject

---

## 5. Fetch Data + Conversation

* client.prompt
* client.company_data
* conversation.messages (by client_id + userId)

If no conversation:

→ use empty array

---

## 6. Build Prompt

Combine:

* prompt template
* company data
* conversation history
* userLastMessage

---

## 7. Call AI

For now:

→ mock function

Later:

→ real AI

---

## 8. Append Messages

Add:

user → userLastMessage
assistant → AI reply

---

## 9. Save Conversation

Upsert using:

client_id + userId

Store:

messages (last 20 only)

---

## 10. Log Usage

Insert:

client_id
timestamp

---

## 11. Return Response

reply: string

---

# ⚡ Optimized Flow (Production Style)

```text
Request
 ↓
Validate API key
 ↓
Fetch client
 ↓
Check active + usage
 ↓
Fetch conversation
 ↓
Build prompt
 ↓
AI call
 ↓
Save conversation
 ↓
Log usage
 ↓
Response
```

---

# ⚠️ Edge Cases You Must Handle

---

### 1. New user (no conversation)

→ start with empty array

---

### 2. Invalid API key

→ return error immediately

---

### 3. Usage exceeded

→ block before AI call

---

### 4. DB returns null

→ fallback safely

---

### 5. Large conversation

→ trim to last 20 messages

---

# 🔥 Final Insight

This flow is:

> ✅ Efficient
> ✅ Secure
> ✅ Scalable for 10–20 clients
> ✅ AI-cost optimized

---

> implement webhook code

Perfect—let’s implement your **webhook API end-to-end** using the exact flow you defined.

This is **clean, minimal, production-ready (for 10–20 clients)**.

---

# 🧱 File: `db/supabase.js`

```js
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
```

---

# 🔐 File: `utils/hash.js`

```js
import crypto from "crypto";

export const hashApiKey = (key) => {
  return crypto.createHash("sha256").update(key).digest("hex");
};
```

---

# 🤖 File: `services/mockAI.js`

```js
export const mockAI = async (prompt) => {
  await new Promise((res) => setTimeout(res, 200));

  return `🤖 Mock reply based on: "${prompt.slice(0, 60)}..."`;
};
```

---

# 💬 File: `services/conversation.service.js`

```js
import { supabase } from "../db/supabase.js";

export const getConversation = async (clientId, userId) => {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .single();

  return data?.messages || [];
};

export const saveConversation = async ({
  clientId,
  userId,
  messages
}) => {
  await supabase
    .from("conversations")
    .upsert(
      {
        client_id: clientId,
        user_id: userId,
        messages: messages.slice(-20),
        updated_at: new Date()
      },
      { onConflict: "client_id,user_id" }
    );
};
```

---

# 📊 File: `services/usage.service.js`

```js
import { supabase } from "../db/supabase.js";

export const checkUsage = async (clientId, limit) => {
  const today = new Date().toISOString().slice(0, 10);

  const { count } = await supabase
    .from("usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .gte("created_at", today);

  if (count >= limit) {
    throw new Error("Usage limit exceeded");
  }
};

export const logUsage = async (clientId) => {
  await supabase.from("usage_logs").insert({
    client_id: clientId
  });
};
```

---

# 🧠 File: `utils/promptBuilder.js`

```js
export const buildPrompt = ({
  prompt,
  companyData,
  history,
  message
}) => {
  const formattedHistory = history
    .map((m) =>
      `${m.role === "user" ? "Customer" : "Assistant"}: ${m.text}`
    )
    .join("\n");

  return `
${prompt}

Company Info:
${JSON.stringify(companyData)}

Conversation:
${formattedHistory}

Customer: ${message}
Reply:
`;
};
```

---

# 🚀 File: `controllers/webhook.controller.js`

```js
import { supabase } from "../db/supabase.js";
import { hashApiKey } from "../utils/hash.js";
import { getConversation, saveConversation } from "../services/conversation.service.js";
import { checkUsage, logUsage } from "../services/usage.service.js";
import { buildPrompt } from "../utils/promptBuilder.js";
import { mockAI } from "../services/mockAI.js";

export const webhookHandler = async (req, res) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const { userId, userLastMessage } = req.body;

    if (!apiKey) {
      return res.status(401).json({ error: "Missing API key" });
    }

    if (!userId || !userLastMessage) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    // 1. Validate API key
    const hashed = hashApiKey(apiKey);

    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("api_key_hash", hashed)
      .single();

    if (!client) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // 2. Check active
    if (!client.is_active) {
      return res.status(403).json({ error: "Client disabled" });
    }

    // 3. Check usage
    await checkUsage(client.id, client.allowed_tokens);

    // 4. Load conversation
    const history = await getConversation(client.id, userId);

    // 5. Build prompt
    const prompt = buildPrompt({
      prompt: client.prompt,
      companyData: client.company_data,
      history,
      message: userLastMessage
    });

    // 6. AI call
    const reply = await mockAI(prompt);

    // 7. Append messages
    const updatedMessages = [
      ...history,
      { role: "user", text: userLastMessage },
      { role: "assistant", text: reply }
    ];

    // 8. Save conversation
    await saveConversation({
      clientId: client.id,
      userId,
      messages: updatedMessages
    });

    // 9. Log usage
    await logUsage(client.id);

    // 10. Return response
    return res.json({ reply });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
```

---

# 🌐 File: `routes/webhook.routes.js`

```js
import express from "express";
import { webhookHandler } from "../controllers/webhook.controller.js";

const router = express.Router();

router.post("/webhook", webhookHandler);

export default router;
```

---

# 🏁 File: `server.js`

```js
import express from "express";
import dotenv from "dotenv";
import webhookRoutes from "./routes/webhook.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/", webhookRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

---

# 🧪 Test Request

POST [http://localhost:3000/webhook](http://localhost:3000/webhook)

Headers:

x-api-key: YOUR_CLIENT_API_KEY

Body:

{
"userId": "user_1",
"userLastMessage": "Hi, do you have discounts?"
}

---

# 🎯 What You Now Have

* ✅ Secure API key validation (hashed)
* ✅ Usage limiting
* ✅ Conversation memory
* ✅ Prompt builder
* ✅ Mock AI (ready to swap)
* ✅ Full webhook pipeline

------------------------

Perfect—these two tables are the backbone of your system. I’ll give you **clean, production-ready schemas** optimized for your use case (10–20 clients, AI chat, usage tracking).

---

# 🧱 conversations Table

### Purpose

Stores chat history per **client + user**

---

### Schema

create table conversations (
id uuid primary key default gen_random_uuid(),

client_id uuid not null,
user_id text not null,

messages jsonb default '[]',

updated_at timestamp default now(),

unique(client_id, user_id)
);

---

### 🔑 Key Design Decisions

#### ✅ unique(client_id, user_id)

* ensures one conversation per user per client
* enables clean upsert logic

---

#### ✅ messages (jsonb)

Stores:

[
{ "role": "user", "text": "Hi" },
{ "role": "assistant", "text": "Hello!" }
]

---

#### ✅ updated_at

* useful for sorting / cleanup later

---

# ⚡ Recommended Indexes

create index idx_conversations_client_user
on conversations(client_id, user_id);

create index idx_conversations_updated_at
on conversations(updated_at);

---

# ⚠️ Rules

* always trim messages → last 20 entries
* never store unlimited history
* always upsert using (client_id, user_id)

---

# 🧱 usage_logs Table

### Purpose

Tracks API usage for billing / limits

---

### Schema

create table usage_logs (
id uuid primary key default gen_random_uuid(),

client_id uuid not null,
user_id text,

created_at timestamp default now()
);

---

### 🔑 Key Design Decisions

#### ✅ One row = one request

* simple
* accurate
* no race conditions

---

#### ✅ created_at

* used to calculate daily usage

---

# ⚡ Recommended Indexes (VERY IMPORTANT)

create index idx_usage_client_date
on usage_logs(client_id, created_at);

---

# 📊 Usage Query (Daily Count)

select count(*)
from usage_logs
where client_id = 'CLIENT_ID'
and created_at >= date_trunc('day', now());

---

# ⚠️ Rules

* log usage AFTER successful request
* never update counts manually
* always calculate from logs

---

# 🧠 Combined Data Model

---

## clients

* who the customer is
* config + limits

---

## conversations

* chat memory

---

## usage_logs

* tracking + billing

---

# 🔥 Final Architecture

```text
clients → identity + limits + prompt
   ↓
conversations → chat memory
   ↓
usage_logs → request tracking
```

---

# 🚀 Why This Works

* simple
* scalable for your size
* no race conditions
* easy to query
* AI-friendly

---

# ⚡ What You Can Do Next

You now have a complete DB:

👉 clients
👉 conversations
👉 usage_logs



