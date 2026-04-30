# Requirements

# AI Chat Automation Backend — Requirement Document

---

## 1. System Overview

This system provides:

* AI-powered chat automation via webhook
* Multi-client (SaaS-style) architecture
* API key–based authentication
* Usage limiting per client

### High-Level Flow

Admin → Create Client → Generate API Key → Give to Client
Client → Send Message → Webhook → AI → Response

---

## 2. Authentication Design

### Admin Authentication

* Uses ADMIN_SECRET
* Stored in environment (.env)
* Passed via body:

admin-key: ADMIN_SECRET

---

### Client Authentication

* Each client has an API key
* Only hashed version stored in database
* Passed via header:

x-api-key: client_api_key

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

### conversations table

create table conversations (
id uuid primary key default gen_random_uuid(),
client_id uuid,
user_id text,
messages jsonb default '[]',
updated_at timestamp default now(),
unique(client_id, user_id)
);

---

### usage_logs table

create table usage_logs (
id uuid primary key default gen_random_uuid(),
client_id uuid,
created_at timestamp default now()
);

---

## 4. Admin APIs

All admin APIs require header:

x-admin-key: ADMIN_SECRET

---

### 4.1 Create Client

Endpoint: POST /admin/clients

Request body:

name: string
email: string
allowed_tokens: number
prompt: string
company_data: object

Response:

client:
id: uuid
name: string

---

### 4.2 Generate API Key

Endpoint: POST /admin/api-key

Request body:

clientId: uuid

Flow:

* Generate secure API key
* Hash API key
* Store hash in database

Response:

apiKey: sk_live_xxxxxx

Note: API key is returned only once

---

### 4.3 Update Client

Endpoint: PUT /admin/clients/:clientId

Allowed updates:

* allowed_tokens
* prompt
* company_data
* is_active

Response:

client: updated client object

---

### 4.4 Delete Client

Endpoint: DELETE /admin/clients/:clientId

Flow:

* Delete client
* Cascade delete related data

Response:

message: Client deleted

---

## 5. Client API

### 5.1 Webhook API (AI Automation)

Endpoint: POST /webhook

Headers:

x-api-key: client_api_key

Request body:

userId: string
message: string

---

### Full Processing Flow

1. Validate API key (hash comparison)
2. Check client is_active
3. Check usage limit
4. Load conversation
5. Build prompt
6. Call AI (mock or real)
7. Save conversation
8. Log usage
9. Return response

---

### Response

reply: AI generated response

---

### Errors

error: Invalid API key
error: Client disabled
error: Usage limit exceeded

---

## 6. Conversation Format

messages:

role: user | assistant
text: string

Example:

* role: user, text: Hi
* role: assistant, text: Hello!

---

## 7. Usage Control

Track each request in usage_logs table

Query for daily usage:

select count(*)
from usage_logs
where client_id = CLIENT_ID
and created_at >= date_trunc('day', now())

Compare with allowed_tokens

Block request if limit exceeded

---

## 8. Prompt System

Prompt template stored per client:

You are a {{tone}} for {{company}}

{{company_data}}

{{history}}

Customer: {{message}}
Reply:

---

## 9. Security Rules

* API keys are hashed using SHA-256
* Raw API keys are never stored
* Admin secret stored only in environment
* Admin APIs are protected
* Client APIs use API key authentication

---

## 10. Performance Requirements

* Response time should be under 2 seconds
* Limit conversation history to last 20 messages
* Use indexes on client_id and created_at

---

## 11. Final System Flow

ADMIN FLOW:

Create client → Generate API key → Share with client

CLIENT FLOW:

Send message → Webhook → AI → Response

BACKEND FLOW:

Authenticate → Check usage → Load data → Build prompt → AI → Save → Respond

---

## 12. Scope

* Designed for 10–20 clients
* Low to moderate traffic
* No queues required
* No caching required

---

## Final Outcome

This system provides:

* Multi-client AI backend
* Secure API key authentication
* Usage tracking and limits
* Dynamic prompt system

---
