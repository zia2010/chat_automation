import { getSupabase } from "../db/supabase.js";

/**
 * getConversation(clientId, userId)
 *
 * What this does:
 * - Looks up the chat history for a specific client + user pair
 * - Returns the messages array, or empty array if no history
 *
 * Why a separate service?
 * - Keeps the webhook controller clean
 * - This logic can be reused elsewhere if needed
 */
export const getConversation = async (clientId, userId) => {
  const { data } = await getSupabase()
    .from("conversations")
    .select("*")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .single();

  return data?.messages || [];
};

/**
 * saveConversation({ clientId, userId, messages })
 *
 * What this does:
 * - Saves the updated chat history back to the database
 * - Uses "upsert" = update if exists, insert if new
 * - Only keeps the last 20 messages (trims old ones)
 *
 * Why trim to 20?
 * - AI has a limit on how much text it can process
 * - Storing unlimited messages wastes DB space
 * - 20 messages is enough context for good replies
 *
 * What is upsert?
 * - "update + insert" combined
 * - If a row with (client_id, user_id) exists → update it
 * - If no row exists → create a new one
 * - onConflict: "client_id,user_id" tells Supabase which columns to check
 */
export const saveConversation = async ({ clientId, userId, messages }) => {
  await getSupabase()
    .from("conversations")
    .upsert(
      {
        client_id: clientId,
        user_id: userId,
        messages: messages.slice(-20), // keep only last 20 messages
        updated_at: new Date()
      },
      { onConflict: "client_id,user_id" }
    );
};
