import { getSupabase } from "../db/supabase.js";

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
