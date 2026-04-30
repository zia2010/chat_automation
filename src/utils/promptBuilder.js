/**
 * buildPrompt()
 *
 * What this does:
 * - Takes all the pieces of context and combines them into one big text
 * - This text is what gets sent to the AI
 *
 * Why?
 * - AI doesn't know anything about your client's business
 * - We need to tell it: "here's who you are, here's the company info,
 *   here's what was said before, and here's the new message"
 *
 * What each part does:
 * - prompt: Instructions for the AI (e.g., "You are a sales assistant")
 * - companyData: Business info (e.g., { offers: "10% off" })
 * - history: Previous messages between user and AI
 * - message: The new message from the user right now
 *
 * The final output looks like:
 * ---------------------------------
 * You are a sales assistant
 *
 * Company Info:
 * {"offers":"10% off"}
 *
 * Conversation:
 * Customer: Hi
 * Assistant: Hello! How can I help?
 *
 * Customer: Do you have discounts?
 * Reply:
 * ---------------------------------
 */
export const buildPrompt = ({ prompt, companyData, history, message }) => {
  // Convert history array into readable text
  // Each message has: { role: "user" or "assistant", text: "..." }
  // We format it as "Customer: ..." or "Assistant: ..."
  const formattedHistory = history
    .map((m) =>
      `${m.role === "user" ? "Customer" : "Assistant"}: ${m.text}`
    )
    .join("\n");

  // Combine everything into one string
  return `
${prompt}

Company Info:
${JSON.stringify(companyData)}

Conversation:
${formattedHistory}

Customer: ${message}
Reply:
`;
};
