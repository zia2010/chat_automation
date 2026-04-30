import { getSupabase } from "../db/supabase.js";

/**
 * logUsage(clientId)
 *
 * What this does:
 * - Inserts one row into usage_logs table
 * - Each row = one API request made by this client
 *
 * Why?
 * - Tracks how many times a client uses your API
 * - Used for daily limit checking (Piece 2)
 * - Can be used later for billing
 *
 * Why log AFTER the successful response?
 * - Only count requests that actually worked
 * - If AI fails or something breaks, don't charge the client
 */
export const logUsage = async (clientId, userId) => {
  await getSupabase()
    .from("usage_logs")
    .insert({
      client_id: clientId,
      user_id: userId
    });
};
