import { mockAI } from "../providers/mock.provider.js";

/**
 * AI SERVICE (Orchestrator)
 *
 * What this does:
 * - Acts as the "middleman" between your webhook and the actual AI
 * - Reads AI_PROVIDER from .env to decide which AI to use
 * - Currently supports: mock (later: gemini, openai, etc.)
 *
 * Why not call mockAI directly in the webhook?
 * - Tomorrow you might want Gemini, OpenAI, Claude...
 * - With this service, you change ONE env variable → done
 * - No need to touch webhook code at all
 *
 * How PROVIDERS object works:
 * - It's like a dictionary: { name: function }
 * - PROVIDERS["mock"] → returns the mockAI function
 * - PROVIDERS["gemini"] → will return geminiProvider (added later)
 *
 * FALLBACK_MESSAGE:
 * - If AI completely fails (crash, timeout, etc.)
 * - Instead of showing an error to the user, show a friendly message
 */

// Map of provider names to their functions
const PROVIDERS = {
  mock: mockAI
  // gemini: geminiProvider  ← will be added in Step 7
};

// Friendly message if everything fails
const FALLBACK_MESSAGE = "Hey! We'll get back to you shortly 😊";

/**
 * generateAIResponse({ prompt })
 *
 * The main function your webhook calls.
 *
 * Flow:
 * 1. Read AI_PROVIDER from .env (default: "mock")
 * 2. Find the matching provider function
 * 3. Call it with the prompt
 * 4. Return the response
 * 5. If anything fails → return fallback message
 */
export const generateAIResponse = async ({ prompt }) => {
  // Step 1: Which provider to use? Read from .env
  // process.env.AI_PROVIDER = whatever you set in .env file
  // || "mock" = if not set, default to mock
  const providerName = process.env.AI_PROVIDER || "mock";

  // Step 2: Get the function for this provider
  const provider = PROVIDERS[providerName];

  // Step 3: If someone typed a wrong name in .env, throw error
  if (!provider) {
    throw new Error(`Invalid AI provider: ${providerName}`);
  }

  try {
    // Step 4: Call the provider with the prompt and get the reply
    const response = await provider(prompt);

    return response;
  } catch (err) {
    // Step 5: If AI crashes → log error + return friendly fallback
    console.error("AI Error:", err.message);
    return FALLBACK_MESSAGE;
  }
};
