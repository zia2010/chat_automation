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
