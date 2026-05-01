# AI Layer — Complete Design Document

---

## 🎯 Objective

Design a **scalable, fault-tolerant AI layer** that:

* Accepts a fully built prompt
* Selects AI provider (mock / Gemini)
* Ensures availability (startup + runtime checks)
* Generates response safely
* Returns fallback if AI fails
* Remains **replaceable + extensible**

---

## 🧠 System Context

AI Layer sits inside this pipeline:

```
ManyChat
   ↓
Webhook Controller
   ↓
Auth + Usage Check
   ↓
Load Client + Conversation
   ↓
Prompt Builder
   ↓
AI Layer   ← (THIS DOCUMENT)
   ↓
Save Conversation + Log Usage
   ↓
Response
```

---

## 🏗️ Architecture Overview

### Core Design Principles

* **Provider abstraction** (Gemini, mock, future OpenAI)
* **Environment-based switching**
* **Health-aware execution**
* **Fail-safe responses**
* **No business logic in providers**

---

## 📁 Folder Structure

```
src/
  services/
    ai.service.js            # AI orchestrator
    aiHealth.service.js      # Health checks (startup + runtime)

  providers/
    gemini.provider.js       # Gemini API integration
    mock.provider.js         # Mock AI (dev/testing)

  utils/
    promptBuilder.js         # Already implemented
```

---

## ⚙️ Environment Configuration

### `.env`

```
AI_PROVIDER=mock            # mock | gemini
NODE_ENV=development
GEMINI_API_KEY=your_key
```

### Production

```
AI_PROVIDER=gemini
NODE_ENV=production
```

---

## 🔄 AI Execution Flow

```
Prompt (string)
   ↓
AI Service
   ↓
Check provider (ENV)
   ↓
If Gemini → check health
   ↓
Call provider
   ↓
Return response OR fallback
```

---

## 🧩 1. AI Service (Orchestrator)

### Responsibilities

* Select provider
* Enforce health checks
* Handle timeout
* Handle errors
* Provide fallback response

---

### `src/services/ai.service.js`

```js
import { geminiProvider } from "../providers/gemini.provider.js";
import { mockAI } from "../providers/mock.provider.js";
import { getGeminiHealth } from "./aiHealth.service.js";

const PROVIDERS = {
  gemini: geminiProvider,
  mock: mockAI
};

const FALLBACK_MESSAGE = "Hey! We’ll get back to you shortly 😊";

export const generateAIResponse = async ({ prompt }) => {
  const providerName = process.env.AI_PROVIDER || "mock";
  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(`Invalid AI provider: ${providerName}`);
  }

  try {
    // Runtime health check for Gemini
    if (providerName === "gemini") {
      const healthy = await getGeminiHealth();

      if (!healthy) {
        console.warn("⚠️ Gemini unhealthy → fallback to mock");
        return await mockAI(prompt);
      }
    }

    const response = await withTimeout(provider(prompt), 5000);

    return response;
  } catch (err) {
    console.error("AI Error:", err.message);
    return FALLBACK_MESSAGE;
  }
};
```

---

## ⏱️ Timeout Utility

```js
const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI Timeout")), ms)
  );

  return Promise.race([promise, timeout]);
};
```

---

## 🧪 2. Mock Provider

### Purpose

* Free testing
* No API cost
* Predictable responses

---

### `src/providers/mock.provider.js`

```js
export const mockAI = async (prompt) => {
  await new Promise((res) => setTimeout(res, 200));

  return `🤖 Mock reply based on: "${prompt.slice(0, 80)}..."`;
};
```

---

## 🤖 3. Gemini Provider

Using Google Gemini API

---

### `src/providers/gemini.provider.js`

```js
import axios from "axios";

export const geminiProvider = async (prompt) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const res = await axios.post(url, {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  });

  return (
    res.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Sorry, could you rephrase?"
  );
};
```

---

## 🧠 4. AI Health Service

### Purpose

* Prevent broken AI calls
* Avoid wasting API cost
* Enable fallback behavior

---

### `src/services/aiHealth.service.js`

```js
import { geminiProvider } from "../providers/gemini.provider.js";

let isGeminiHealthy = false;
let lastCheckedAt = 0;

const HEALTH_CACHE_MS = 60000; // 1 minute

export const checkGeminiHealth = async () => {
  try {
    const res = await geminiProvider("Say OK");

    if (res && res.length > 0) {
      isGeminiHealthy = true;
    } else {
      throw new Error("Empty response");
    }
  } catch (err) {
    console.error("Gemini health check failed:", err.message);
    isGeminiHealthy = false;
  }

  lastCheckedAt = Date.now();
  return isGeminiHealthy;
};

export const getGeminiHealth = async () => {
  const now = Date.now();

  if (now - lastCheckedAt < HEALTH_CACHE_MS) {
    return isGeminiHealthy;
  }

  return await checkGeminiHealth();
};
```

---

## 🚀 5. Startup Health Check

### Add in `src/index.js`

```js
import { checkGeminiHealth } from "./services/aiHealth.service.js";

const startServer = async () => {
  if (process.env.AI_PROVIDER === "gemini") {
    console.log("🔍 Checking Gemini connection...");

    const isHealthy = await checkGeminiHealth();

    if (!isHealthy) {
      console.error("❌ Gemini not working");

      if (process.env.NODE_ENV === "production") {
        process.exit(1);
      }

      console.warn("⚠️ Continuing in dev mode");
    } else {
      console.log("✅ Gemini is healthy");
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on ${PORT}`);
  });
};

startServer();
```

---

## 🔌 Integration in Webhook

```js
import { generateAIResponse } from "../services/ai.service.js";

const reply = await generateAIResponse({ prompt });
```

---

## ⚠️ Error Handling Strategy

| Scenario         | Behavior         |
| ---------------- | ---------------- |
| Gemini down      | fallback to mock |
| Timeout (>5s)    | fallback message |
| Invalid provider | throw error      |
| API failure      | fallback message |

---

## 🔐 Production Safety

* Validate `GEMINI_API_KEY`
* Timeout all AI calls
* Cache health checks
* Avoid repeated API failures

---

## 📈 Future Enhancements

### 1. Per-client provider

```
client.ai_provider = "gemini" | "mock"
```

---

### 2. Usage tracking

Track:

* tokens used
* cost per client

---

### 3. Retry mechanism

```
retry 2 times before fallback
```

---

### 4. Response caching

Avoid duplicate AI calls

---

### 5. Streaming support

---

## ⚠️ Common Mistakes

❌ Calling AI directly in controller
❌ No timeout → hanging requests
❌ No fallback → broken UX
❌ Overloading prompt → slow + expensive

---

## 🧠 Final Architecture

```
ManyChat
   ↓
Webhook
   ↓
Prompt Builder
   ↓
AI Service
   ↓
Health Check
   ↓
Provider (ENV controlled)
   ↓
Gemini / Mock
   ↓
Response
```

---

## ✅ Status

* AI abstraction: ✅
* Provider switching: ✅
* Health checks: ✅
* Timeout + fallback: ✅
* Production-ready: ✅

---

## 🎯 Summary

This AI Layer is:

* Modular
* Replaceable
* Cost-aware
* Fault-tolerant
* Scalable

👉 Ready for real clients
