/**
 * mockAI(prompt)
 *
 * What this does:
 * - Pretends to be an AI
 * - Takes the prompt (the big text we built) and returns a fake reply
 * - Has a small delay (200ms) to simulate real AI response time
 *
 * Why mock?
 * - Real AI (like OpenAI) costs money per request
 * - While building/testing, we use this fake version
 * - Later, you just swap this function with a real AI call
 *
 * How to swap later:
 * - Replace the body of this function with an OpenAI API call
 * - Everything else in the system stays the same!
 */
export const mockAI = async (prompt) => {
  // Simulate a small delay (like real AI would take)
  await new Promise((res) => setTimeout(res, 200));

  // Return a fake reply
  // .slice(0, 60) = take first 60 chars of the prompt (just for display)
  return `🤖 Mock reply based on: "${prompt.slice(0, 60)}..."`;
};
