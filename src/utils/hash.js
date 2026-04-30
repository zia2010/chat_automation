import crypto from "crypto";

/**
 * hashApiKey(key)
 *
 * What this does:
 * - Takes a raw API key (e.g., "sk_live_abc123...")
 * - Converts it into a fixed-length scrambled string (hash)
 *
 * Why?
 * - You never store the raw key in your database
 * - If someone steals your DB, they can't see the real keys
 * - When a client sends their key, you hash it and compare with the stored hash
 *
 * SHA-256 = a one-way hashing algorithm (can't reverse it)
 */
export const hashApiKey = (key) => {
  return crypto.createHash("sha256").update(key).digest("hex");
};
