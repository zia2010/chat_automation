import { getSupabase } from "../db/supabase.js";
import { generateApiKey } from "../utils/apiKey.js";
import { hashApiKey } from "../utils/hash.js";

/**
 * CREATE CLIENT
 *
 * What this does:
 * - Takes client info from the request body (name, email, etc.)
 * - Inserts it into the "clients" table in Supabase
 * - Returns the created client data
 *
 * Why:
 * - This is how you (admin) register a new customer in your system
 */
export const createClient = async (req, res) => {
  try {
    // Step 1: Get data from request body
    // req.body = whatever JSON the admin sends in Postman
    const { name, email, allowed_tokens, prompt, company_data } = req.body;

    // Step 2: Validate — name is required at minimum
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Step 3: Insert into database
    // .from("clients") = target the clients table
    // .insert({...}) = add a new row with this data
    // .select() = return the inserted row back to us
    // .single() = we only expect 1 row back
    const { data, error } = await getSupabase()
      .from("clients")
      .insert({
        name,
        email,
        allowed_tokens,
        prompt,
        company_data
      })
      .select()
      .single();

    // Step 4: If Supabase returned an error, throw it
    if (error) throw error;

    // Step 5: Send back the created client
    return res.json({ client: data });

  } catch (err) {
    // If anything goes wrong, send a 500 error
    return res.status(500).json({ error: err.message });
  }
};


/**
 * GENERATE API KEY
 *
 * What this does:
 * - Takes a clientId from request body
 * - Generates a random API key (sk_live_xxx)
 * - Hashes the key (so we never store the raw version)
 * - Saves the hash in the client's row in the DB
 * - Returns the raw key to admin (only shown once!)
 *
 * Why:
 * - The client needs this key to call your webhook
 * - You only store the hash for security
 * - If they lose the key, you generate a new one (old one stops working)
 */
export const generateApiKeyHandler = async (req, res) => {
  try {
    // Step 1: Get clientId from request body
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    // Step 2: Generate a new random API key
    const apiKey = generateApiKey();

    // Step 3: Hash it (this is what we store in DB)
    const hash = hashApiKey(apiKey);

    // Step 4: Update the client's row with the hashed key
    const { error } = await getSupabase()
      .from("clients")
      .update({ api_key_hash: hash })
      .eq("id", clientId);

    if (error) throw error;

    // Step 5: Return the raw key (shown only once!)
    return res.json({ apiKey });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


/**
 * UPDATE CLIENT
 *
 * What this does:
 * - Takes a clientId from the URL (e.g., /admin/clients/abc-123)
 * - Takes updated fields from request body
 * - Updates ONLY the allowed fields in the database
 * - Returns the updated client
 *
 * Why:
 * - You might want to change a client's token limit, prompt, or disable them
 * - We restrict which fields can be updated for safety
 *   (you can't accidentally change their id or name via this endpoint)
 *
 * What is req.params?
 * - When URL is /admin/clients/:clientId
 * - And someone hits /admin/clients/abc-123
 * - Then req.params.clientId = "abc-123"
 */
export const updateClient = async (req, res) => {
  try {
    // Step 1: Get clientId from URL params
    const { clientId } = req.params;

    // Step 2: Get only the fields we ALLOW to be updated
    // Even if someone sends "id" or "name" in body, we ignore it
    const { allowed_tokens, prompt, company_data, is_active } = req.body;

    // Step 3: Build an updates object with only provided fields
    // Why? We don't want to overwrite fields with "undefined"
    const updates = {};
    if (allowed_tokens !== undefined) updates.allowed_tokens = allowed_tokens;
    if (prompt !== undefined) updates.prompt = prompt;
    if (company_data !== undefined) updates.company_data = company_data;
    if (is_active !== undefined) updates.is_active = is_active;

    // Step 4: If nothing was provided to update, reject
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Step 5: Update the row in the database
    // .update(updates) = change these columns
    // .eq("id", clientId) = only where id matches
    // .select() = return the updated row
    // .single() = we expect exactly 1 row
    const { data, error } = await getSupabase()
      .from("clients")
      .update(updates)
      .eq("id", clientId)
      .select()
      .single();

    if (error) throw error;

    // Step 6: Return updated client
    return res.json({ client: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};


/**
 * DELETE CLIENT
 *
 * What this does:
 * - Takes a clientId from the URL
 * - Deletes that client from the database
 * - Also deletes their conversations and usage logs (cleanup)
 *
 * Why:
 * - When you no longer want a client in your system
 * - You remove them and all their data
 *
 * Important:
 * - This is permanent! Once deleted, data is gone
 * - In production, you might prefer "soft delete" (set is_active = false)
 *   but for now, hard delete is fine for learning
 */
export const deleteClient = async (req, res) => {
  try {
    // Step 1: Get clientId from URL params
    const { clientId } = req.params;

    // Step 2: Delete related conversations (cleanup)
    await getSupabase()
      .from("conversations")
      .delete()
      .eq("client_id", clientId);

    // Step 3: Delete related usage logs (cleanup)
    await getSupabase()
      .from("usage_logs")
      .delete()
      .eq("client_id", clientId);

    // Step 4: Delete the client itself
    const { error } = await getSupabase()
      .from("clients")
      .delete()
      .eq("id", clientId);

    if (error) throw error;

    // Step 5: Confirm deletion
    return res.json({ message: "Client deleted successfully" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
