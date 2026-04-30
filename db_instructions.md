# Database Setup Instructions

## How to Create Tables in Supabase

1. Go to your Supabase dashboard
2. Click **SQL Editor** in the left sidebar
3. Paste each SQL block below and click **Run**

---

## Table 1 — clients

Stores your customers, their config, API key, and prompt.

```sql
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
```

---

## Table 2 — conversations

Stores chat history per user per client.

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  user_id text not null,
  messages jsonb default '[]',
  updated_at timestamp default now(),
  unique(client_id, user_id)
);

create index idx_conversations_client_user on conversations(client_id, user_id);
create index idx_conversations_updated_at on conversations(updated_at);
```

---

## Table 3 — usage_logs

Tracks every API request for daily usage limits and billing.

```sql
create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  user_id text,
  created_at timestamp default now()
);

create index idx_usage_client_date on usage_logs(client_id, created_at);
```

---

## Summary

| Table          | Purpose                                   |
|----------------|-------------------------------------------|
| clients        | Customer identity + config + API key hash |
| conversations  | Chat memory per user per client           |
| usage_logs     | Request tracking for limits / billing     |

---

## Verification

After creating all tables, restart your server and hit:

```
GET http://localhost:3000/admin/db-check
Header: x-admin-key: your_super_secret_key
```

Expected response:

```json
{ "status": "ok", "message": "DB connected", "rows": 0 }
```
