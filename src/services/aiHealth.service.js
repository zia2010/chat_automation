/**
 * AI HEALTH SERVICE
 *
 * What this does:
 * - Checks if Gemini AI is working before you use it
 * - Caches the result so you don't spam Google with health checks
 * - Used by: AI Service (runtime) + server.js (startup)
 *
 * Why?
 * - If Gemini is down, calling it wastes time + costs money
 * - Better to check once and remember the result
 * - If unhealthy → AI Service can fallback to mock
 *
 * Two exported functions:
 *
 * checkGeminiHealth()
 *   - Actually calls Gemini with a tiny prompt "Say OK"
 *   - If it responds → healthy = true
 *   - If it fails → healthy = false
 *   - Updates the cache
 *
 * getGeminiHealth()
 *   - First checks: "Did we already check in the last 60 seconds?"
 *   - If yes → return cached result (fast! no API call)
 *   - If no → call checkGeminiHealth() to refresh
 *
 * Cache flow:
 *   Request 1 (0s)   → calls Gemini → caches result
 *   Request 2 (10s)  → returns cached result (no API call)
 *   Request 3 (30s)  → returns cached result (no API call)
 *   Request 4 (65s)  → cache expired → calls Gemini again
 */
import { geminiProvider } from "../providers/gemini.provider.js";

// These variables live in memory (not in DB)
// They reset when you restart the server
let isGeminiHealthy = false; // Is Gemini currently working?
let lastCheckedAt = 0; // Timestamp of last check (0 = never checked)

// How long to trust the cached result (60 seconds = 60000 milliseconds)
const HEALTH_CACHE_MS = 60000;

/**
 * checkGeminiHealth()
 *
 * Actually tests Gemini by sending a tiny prompt.
 * This is the "real" check — it makes an API call.
 *
 * Returns: true if healthy, false if not
 */
export const checkGeminiHealth = async () => {
  try {
    // Send a tiny prompt — just enough to verify Gemini responds
    const res = await geminiProvider("Say OK");

    // If we got a non-empty response, Gemini is alive
    if (res && res.length > 0) {
      isGeminiHealthy = true;
    } else {
      // Got an empty response — something is wrong
      throw new Error("Empty response from Gemini");
    }
  } catch (err) {
    // Gemini failed — could be network, bad key, outage, etc.
    console.error("❌ Gemini health check failed:", err.message);
    isGeminiHealthy = false;
  }

  // Remember when we last checked
  lastCheckedAt = Date.now();

  return isGeminiHealthy;
};

/**
 * getGeminiHealth()
 *
 * Smart health check — uses cache when possible.
 * This is what the AI Service calls at runtime.
 *
 * Flow:
 * 1. What time is it now?
 * 2. How long since last check?
 * 3. If less than 60 seconds → return cached result (fast!)
 * 4. If more than 60 seconds → do a real check
 *
 * Returns: true if healthy, false if not
 */
export const getGeminiHealth = async () => {
  const now = Date.now();

  // If we checked less than 60 seconds ago, trust the cached result
  // This prevents spamming Gemini with health checks on every request
  if (now - lastCheckedAt < HEALTH_CACHE_MS) {
    return isGeminiHealthy;
  }

  // Cache expired — do a real check
  return await checkGeminiHealth();
};
