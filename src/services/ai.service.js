import { mockAI } from "../providers/mock.provider.js";
import { geminiProvider } from "../providers/gemini.provider.js";
import { getGeminiHealth } from "./aiHealth.service.js";

/**
 * AI SERVICE (Orchestrator)
 *
 * What this does:
 * - Acts as the "middleman" between your webhook and the actual AI
 * - Reads AI_PROVIDER from .env to decide which AI to use
 * - Checks health before calling Gemini
 * - Enforces a 5-second timeout on all AI calls
 * - Falls back to mock or friendly message if anything fails
 *
 * Flow:
 * 1. Read AI_PROVIDER from .env
 * 2. If gemini → check health first
 *    - Unhealthy? → fallback to mock (don't waste time)
 * 3. Call the provider with a 5-second timeout
 * 4. If timeout or error → return friendly fallback message
 */

// Map of provider names to their functions
const PROVIDERS = {
  mock: mockAI,
  gemini: geminiProvider
};

// Friendly message if everything fails
const FALLBACK_MESSAGE = "Hey! We'll get back to you shortly 😊";

// Maximum time to wait for AI response (5 seconds)
const AI_TIMEOUT_MS = 5000;

/**
 * withTimeout(promise, ms)
 *
 * Races the AI call against a timer.
 * If the AI takes longer than `ms` milliseconds → reject with "AI Timeout"
 *
 * How Promise.race works:
 * - Takes an array of promises
 * - Returns whichever finishes FIRST
 * - If the timer wins → error (timeout)
 * - If the AI wins → success (response)
 *
 * Example:
 *   AI takes 2s, timeout is 5s → AI wins → you get the response
 *   AI takes 8s, timeout is 5s → timer wins → "AI Timeout" error
 */
const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("AI Timeout")), ms)
  );

  return Promise.race([promise, timeout]);
};

/**
 * generateAIResponse({ prompt })
 *
 * The main function your webhook calls.
 *
 * Flow:
 * 1. Read AI_PROVIDER from .env (default: "mock")
 * 2. If gemini → check health (cached, fast)
 *    - Unhealthy → fallback to mock
 * 3. Call provider with 5-second timeout
 * 4. Return response
 * 5. If anything fails → return fallback message
 */
export const generateAIResponse = async ({ prompt }) => {
  const providerName = process.env.AI_PROVIDER || "mock";
  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(`Invalid AI provider: ${providerName}`);
  }

  try {
    // Runtime health check — only for Gemini
    // Mock doesn't need a health check (it always works)
    if (providerName === "gemini") {
      const healthy = await getGeminiHealth();

      if (!healthy) {
        console.warn("⚠️ Gemini unhealthy at runtime → falling back to mock");
        return await withTimeout(mockAI(prompt), AI_TIMEOUT_MS);
      }
    }

    // Call the provider with timeout protection
    // If AI takes longer than 5 seconds → timeout error → catch block → fallback
    const response = await withTimeout(provider(prompt), AI_TIMEOUT_MS);

    return response;
  } catch (err) {
    console.error("AI Error:", err.message);
    return FALLBACK_MESSAGE;
  }
};
