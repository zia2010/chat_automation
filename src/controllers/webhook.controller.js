import { getSupabase } from "../db/supabase.js";
import { hashApiKey } from "../utils/hash.js";

/**
 * WEBHOOK HANDLER
 *
 * This is the API your clients (customers) call to get AI replies.
 * We're building it step by step.
 *
 * Piece 1 — Validate API Key
 * Piece 2 — Check active + usage
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

    // ✅ Piece 2 complete — client is active and under limit!
    // Temporary response (will be replaced by next pieces)
    return res.json({
      message: "Client verified and under limit",
      clientId: client.id,
      clientName: client.name,
      usageToday: count,
      limit: client.allowed_tokens
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
