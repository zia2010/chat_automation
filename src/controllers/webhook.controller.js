import { getSupabase } from "../db/supabase.js";
import { hashApiKey } from "../utils/hash.js";

/**
 * WEBHOOK HANDLER
 *
 * This is the API your clients (customers) call to get AI replies.
 * We're building it step by step. Right now: Piece 1 only.
 *
 * Piece 1 — Validate API Key:
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

    // ✅ Piece 1 complete — client is verified!
    // For now, return the client info to confirm it's working
    // (We'll replace this response as we add more pieces)
    return res.json({
      message: "API key valid",
      clientId: client.id,
      clientName: client.name
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
