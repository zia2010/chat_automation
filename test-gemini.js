import "dotenv/config";
import axios from "axios";

const MODEL = "gemini-2.5-flash";

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

console.log("Testing Gemini API...");
console.log("Model:", MODEL);
console.log(
  "Key starts with:",
  process.env.GEMINI_API_KEY?.slice(0, 8) + "..."
);

try {
  const res = await axios.post(url, {
    contents: [
      {
        parts: [{ text: "Say hello in one word" }]
      }
    ]
  });

  const reply =
    res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

  console.log("✅ Gemini replied:", reply);
} catch (err) {
  const status = err.response?.status;
  const message =
    err.response?.data?.error?.message || err.message;

  console.log("❌ Error:", status, message);

  // Helpful debug hints
  if (status === 429) {
    console.log("⚠️ Quota exceeded → Enable billing or reduce usage");
  }

  if (status === 404) {
    console.log("⚠️ Model not found → Check model name");
  }

  if (status === 401 || status === 403) {
    console.log("⚠️ Invalid API key or permissions issue");
  }
}
