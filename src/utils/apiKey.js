import crypto from "crypto";

/**
 * generateApiKey()
 *
 * What this does:
 * - Creates a random, unique API key string
 * - Format: sk_live_<random 48 characters>
 *
 * Why "sk_live_"?
 * - "sk" = secret key
 * - "live" = production key
 * - This is just a naming convention (like Stripe uses)
 *
 * crypto.randomBytes(24) = generates 24 random bytes
 * .toString("hex") = converts to readable text (48 chars)
 */
export const generateApiKey = () => {
  return `sk_live_${crypto.randomBytes(24).toString("hex")}`;
};
