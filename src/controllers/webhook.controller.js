import { getSupabase } from "../db/supabase.js";
import { hashApiKey } from "../utils/hash.js";
import { buildPrompt } from "../utils/promptBuilder.js";
import { mockAI } from "../services/mockAI.js";
import { saveConversation } from "../services/conversation.service.js";
import { logUsage } from "../services/usage.service.js";

/**
 * WEBHOOK HANDLER
 *
 * This is the API your clients (customers) call to get AI replies.
 * We're building it step by step.
 *
 * Piece 1 — Validate API Key
 * Piece 2 — Check active + usage
 * Piece 3 — Load conversation
 * Piece 4 — Build prompt
 * Piece 5 — Call AI (mock)
 * Piece 6 — Save conversation
 * Piece 7 — Log usage
 * Piece 8 — Return response
 * - Client sends their API key in the "x-api-key" header
 * - We hash it and look for a matching client in the DB
 * - If found → we know who this client is
 * - If not → reject the request
 */
export const webhookHandler = async (req, res) => {
  try {
    // ===== PIECE 1: VALIDATE API KEY =====

    // Step 1: Read the API key from request header
    // The client sends: x-api-key: sk_live_xxx
    const apiKey = req.headers["x-api-key"];

    // Step 2: If no key provided, reject immediately
    if (!apiKey) {
      return res.status(401).json({ error: "Missing API key" });
    }

    // Step 3: Read userId and message from body
    const { userId, userLastMessage } = req.body;

    if (!userId || !userLastMessage) {
      return res.status(400).json({ error: "userId and userLastMessage are required" });
    }

    // Step 4: Hash the API key
    // Why? We stored the HASHED version in DB (never the raw key)
    // So we hash what the client sent and compare
    const hashed = hashApiKey(apiKey);

    // Step 5: Find the client in DB by matching hash
    // .eq("api_key_hash", hashed) = find row where api_key_hash matches
    // .single() = expect exactly one result
    const { data: client, error } = await getSupabase()
      .from("clients")
      .select("*")
      .eq("api_key_hash", hashed)
      .single();

    // Step 6: If no client found, the API key is invalid
    if (error || !client) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // ===== PIECE 2: CHECK ACTIVE + USAGE =====

    // Step 7: Check if client is active
    // Why? Admin can disable a client (is_active = false)
    // A disabled client should not be able to use the webhook
    if (!client.is_active) {
      return res.status(403).json({ error: "Client is disabled" });
    }

    // Step 8: Check daily usage limit
    // Why? Each client has a max number of requests per day (allowed_tokens)
    // We count how many requests they've made today
    // If they've hit the limit → reject (saves your AI costs!)

    // Get today's date in YYYY-MM-DD format
    // .toISOString() = "2026-05-01T12:00:00.000Z"
    // .slice(0, 10)  = "2026-05-01"
    const today = new Date().toISOString().slice(0, 10);

    // Count rows in usage_logs for this client where created_at >= today
    // { count: "exact", head: true } = just give me the count, not the actual rows
    const { count } = await getSupabase()
      .from("usage_logs")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id)
      .gte("created_at", today);

    // If count has reached or exceeded the limit → reject
    if (count >= client.allowed_tokens) {
      return res.status(429).json({ error: "Daily usage limit exceeded" });
    }

    // ===== PIECE 3: LOAD CONVERSATION =====

    // Step 9: Get existing chat history for this user
    // Why? AI needs to know what was said before to give relevant replies
    // Each conversation is stored per client_id + user_id pair
    //
    // Example: client "Demo Brand" + user "user_1" = one conversation
    //          client "Demo Brand" + user "user_2" = separate conversation

    // Query the conversations table
    // .eq("client_id", client.id) = this client's conversations only
    // .eq("user_id", userId) = this specific user's conversation
    // .single() = expect one row (or null if first time)
    const { data: conversation } = await getSupabase()
      .from("conversations")
      .select("*")
      .eq("client_id", client.id)
      .eq("user_id", userId)
      .single();

    // Step 10: Extract messages array
    // If this is a brand new user (no conversation yet) → start with empty array
    // conversation?.messages = if conversation exists, get .messages, else undefined
    // || [] = if undefined, use empty array
    const history = conversation?.messages || [];

    // ✅ Piece 3 complete — we have the chat history!

    // ===== PIECE 4: BUILD PROMPT =====

    // Step 11: Combine everything into one text block for AI
    // Why? AI needs ALL context in one go:
    //   - What role to play (prompt)
    //   - What the company does (company_data)
    //   - What was said before (history)
    //   - What the user just said (userLastMessage)
    const prompt = buildPrompt({
      prompt: client.prompt,
      companyData: client.company_data,
      history,
      message: userLastMessage
    });

    // ✅ Piece 4 complete — prompt is ready for AI!

    // ===== PIECE 5: CALL AI (MOCK) =====

    // Step 12: Send the prompt to AI and get a reply
    // Right now this is a fake AI (mockAI)
    // Later you can swap it with OpenAI, Claude, etc.
    // The rest of the code stays EXACTLY the same!
    const aiStart = Date.now();
    const reply = await mockAI(prompt);
    const aiResponseTime = Date.now() - aiStart;

    // ===== PIECE 6: SAVE CONVERSATION =====

    // Step 13: Add the new messages to history
    // We add both the user's message AND the AI's reply
    // So next time, the AI knows what was said
    const updatedMessages = [
      ...history,                                    // all previous messages
      { role: "user", text: userLastMessage },       // what user just said
      { role: "assistant", text: reply }             // what AI just replied
    ];

    // Step 14: Save to database
    // Uses upsert (update if exists, insert if new)
    // Only keeps last 20 messages to prevent DB overload
    await saveConversation({
      clientId: client.id,
      userId,
      messages: updatedMessages
    });

    // ===== PIECE 7: LOG USAGE =====

    // Step 15: Record that this client made a request
    // Why? So we can count daily usage (Piece 2 checks this)
    // One row in usage_logs = one successful request
    await logUsage(client.id, userId);

    // ===== PIECE 8: RETURN RESPONSE =====

    // Step 16: Send the AI reply back to the client
    // This is what ManyChat / WhatsApp / their system receives
    return res.json({
      message: "Conversation loaded",
      clientId: client.id,
      userId,
      usageToday: count,
      limit: client.allowed_tokens,
      history,
      reply,
      messagesUpdated: true,
      usageUpdated: true,
      aiResponse: true,
      aiResponseTime: `${aiResponseTime}ms`
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
