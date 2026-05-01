/**
 * GEMINI PROVIDER
 *
 * What this does:
 * - Sends a prompt to Google's Gemini AI
 * - Gets back a real AI-generated response
 * - Uses axios to make the HTTP request
 *
 * How it works:
 * 1. Build the API URL with your GEMINI_API_KEY
 * 2. Send the prompt as a POST request
 * 3. Extract the text reply from the response
 * 4. Return it (same format as mockAI — just a string)
 *
 * The Google API expects this format:
 * {
 *   contents: [{ parts: [{ text: "your prompt here" }] }]
 * }
 *
 * And returns:
 * {
 *   candidates: [{ content: { parts: [{ text: "AI reply" }] } }]
 * }
 *
 * Why axios instead of fetch?
 * - Automatic JSON parsing
 * - Better error messages
 * - Built-in timeout support (used later in Step 10)
 */
import axios from "axios";

export const geminiProvider = async (prompt) => {
  // Build the URL — your API key goes in the query string
  // gemini-pro is the model name (Google's text generation model)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  // Send the prompt to Gemini
  const res = await axios.post(url, {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ]
  });

  // Extract the reply text from the nested response
  // res.data = the full JSON response from Google
  // candidates[0] = first (usually only) response option
  // content.parts[0].text = the actual text reply
  //
  // If any of these are missing (rare but possible), return a polite fallback
  return (
    res.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Sorry, could you rephrase that?"
  );
};
