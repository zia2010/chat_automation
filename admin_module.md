Here is your **clean, corrected `requirement.md`** focused on the **admin side (proper design, secure, simple)**:

---

# Admin Backend — Requirement Document

---

## 1. Overview

This module handles all **admin operations** for managing clients in the AI automation system.

Admin responsibilities:

* Create clients
* Generate API keys
* Update client configuration
* Delete clients

---

## 2. Authentication Design

### Admin Authentication

* Uses a single secret: ADMIN_SECRET
* Stored in environment variables (.env)
* Passed via request header

Header format:

x-admin-key: ADMIN_SECRET

---

### Important Rules

* Admin secret must NOT be sent in request body
* Admin secret must NOT be stored in database
* Admin secret must NOT be exposed to frontend

---

## 3. Database Schema

### clients table

create table clients (
id uuid primary key default gen_random_uuid(),
name text not null,
email text,
api_key_hash text,
allowed_tokens int default 1000,
prompt text,
company_data jsonb,
is_active boolean default true,
created_at timestamp default now()
);

---

## 4. Admin API Design

All admin APIs require:

x-admin-key: ADMIN_SECRET

---

## 4.1 Create Client

### Endpoint

POST /admin/clients

---

### Request Body

name: string
email: string
allowed_tokens: number
prompt: string
company_data: object

---

### Flow

* Validate admin key
* Create new client record
* Do NOT generate API key here

---

### Response

client:
id: uuid
name: string

---

## 4.2 Generate API Key

### Endpoint

POST /admin/api-key

---

### Request Body

clientId: uuid

---

### Flow

* Validate admin key
* Generate secure API key
* Hash API key using SHA-256
* Store hashed key in clients table

---

### Response

apiKey: string

---

### Important Notes

* API key is returned only once
* Raw API key must NOT be stored
* Only hashed version is saved

---

## 4.3 Update Client

### Endpoint

PUT /admin/clients/:clientId

---

### Allowed Fields to Update

allowed_tokens
prompt
company_data
is_active

---

### Restricted Fields (Cannot Update)

id
name
email

---

### Flow

* Validate admin key
* Update allowed fields only

---

### Response

client: updated client object

---

## 4.4 Delete Client

### Endpoint

DELETE /admin/clients/:clientId

---

### Flow

* Validate admin key
* Delete client from database
* Related data (conversations, usage) should be removed

---

### Response

message: Client deleted successfully

---

## 5. Security Model

---

### Separation of Roles

Admin:

* Full control over system
* Uses x-admin-key

Client:

* Limited access (only webhook)
* Uses x-api-key

---

### Key Rules

* Admin key and client API keys are completely separate
* Client API key must NEVER be used for admin actions
* Admin APIs must never accept client API keys

---

## 6. API Key Strategy

---

### API Key Format

Example:

sk_live_randomstring

---

### Storage

* Only store hashed key in database
* Use SHA-256 hashing

---

### Usage

* API key is given to client once
* Client uses it for webhook authentication

---

## 7. Recommended Flow

---

### Admin Flow

Create Client
→ Generate API Key
→ Share API Key with client

---

### Client Flow (for reference)

Client sends request
→ Uses API key
→ Access webhook only

---

## 8. Constraints

* Designed for 10–20 clients
* No need for complex auth systems yet
* No need for RBAC or multi-admin setup

---

## 9. Future Improvements (Optional)

* API key rotation
* Admin dashboard UI
* Role-based admin access
* Audit logs

---

## Final Summary

This admin system ensures:

* Secure client management
* Clear separation between admin and client roles
* Safe API key handling
* Scalable structure for SaaS backend



 **clean, working admin APIs**.

Below is a **minimal, production-ready implementation** matching your requirement.md exactly (no overengineering).

---

# 🧱 Folder Structure

src/
db/
supabase.js
utils/
hash.js
apiKey.js
middleware/
adminAuth.js
controllers/
admin.controller.js
routes/
admin.routes.js
server.js

---

# 🧱 db/supabase.js

```js
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
```

---

# 🔐 utils/hash.js

```js
import crypto from "crypto";

export const hashApiKey = (key) => {
  return crypto.createHash("sha256").update(key).digest("hex");
};
```

---

# 🔑 utils/apiKey.js

```js
import crypto from "crypto";

export const generateApiKey = () => {
  return `sk_live_${crypto.randomBytes(24).toString("hex")}`;
};
```

---

# 🛡️ middleware/adminAuth.js

```js
export const validateAdmin = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};
```

---

# 🧠 controllers/admin.controller.js

```js
import { supabase } from "../db/supabase.js";
import { generateApiKey } from "../utils/apiKey.js";
import { hashApiKey } from "../utils/hash.js";

/**
 * 1. Create Client
 */
export const createClient = async (req, res) => {
  try {
    const { name, email, allowed_tokens, prompt, company_data } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const { data, error } = await supabase
      .from("clients")
      .insert({
        name,
        email,
        allowed_tokens,
        prompt,
        company_data
      })
      .select()
      .single();

    if (error) throw error;

    return res.json({ client: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


/**
 * 2. Generate API Key
 */
export const generateApiKeyHandler = async (req, res) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    const apiKey = generateApiKey();
    const hash = hashApiKey(apiKey);

    const { error } = await supabase
      .from("clients")
      .update({ api_key_hash: hash })
      .eq("id", clientId);

    if (error) throw error;

    return res.json({
      apiKey // return only once
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


/**
 * 3. Update Client
 */
export const updateClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const { allowed_tokens, prompt, company_data, is_active } = req.body;

    const updates = {};

    if (allowed_tokens !== undefined) updates.allowed_tokens = allowed_tokens;
    if (prompt !== undefined) updates.prompt = prompt;
    if (company_data !== undefined) updates.company_data = company_data;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", clientId)
      .select()
      .single();

    if (error) throw error;

    return res.json({ client: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


/**
 * 4. Delete Client
 */
export const deleteClient = async (req, res) => {
  try {
    const { clientId } = req.params;

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (error) throw error;

    return res.json({ message: "Client deleted successfully" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
```

---

# 🌐 routes/admin.routes.js

```js
import express from "express";
import {
  createClient,
  generateApiKeyHandler,
  updateClient,
  deleteClient
} from "../controllers/admin.controller.js";
import { validateAdmin } from "../middleware/adminAuth.js";

const router = express.Router();

router.post("/admin/clients", validateAdmin, createClient);
router.post("/admin/api-key", validateAdmin, generateApiKeyHandler);
router.put("/admin/clients/:clientId", validateAdmin, updateClient);
router.delete("/admin/clients/:clientId", validateAdmin, deleteClient);

export default router;
```

---

# 🚀 server.js

```js
import express from "express";
import dotenv from "dotenv";
import adminRoutes from "./routes/admin.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/", adminRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

---

# 🔐 .env

```
ADMIN_SECRET=your_super_secret_key
SUPABASE_URL=your_url
SUPABASE_KEY=your_key
```

---

# 🧪 Example Requests

---

## Create Client

POST /admin/clients
Header: x-admin-key

Body:

{
"name": "Demo Brand",
"email": "[demo@mail.com](mailto:demo@mail.com)",
"allowed_tokens": 1000,
"prompt": "You are a sales assistant",
"company_data": { "offers": "10% off" }
}

---

## Generate API Key

POST /admin/api-key

{
"clientId": "uuid"
}

---

## Update Client

PUT /admin/clients/:clientId

{
"allowed_tokens": 5000,
"is_active": true
}

---

## Delete Client

DELETE /admin/clients/:clientId

---

# 🎯 What You Now Have

* ✅ Secure admin authentication
* ✅ API key generation (hashed)
* ✅ Clean CRUD for clients
* ✅ Matches your requirement doc exactly

---

# 🚀 Next Step

Now you should:

👉 plug this into your webhook system
👉 test with Postman

---

If you want next:

* connect admin + webhook fully
* add validation (Joi/Zod)
* add logging / monitoring

Just say:

> connect everything end to end
