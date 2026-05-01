import "dotenv/config";
import axios from "axios";

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

console.log("Testing Gemini API...");
console.log("Key starts with:", process.env.GEMINI_API_KEY?.slice(0, 8) + "...");

try {
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: "Say hello in one word" }] }]
  });

  const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("✅ Gemini replied:", reply);
} catch (err) {
  console.log("❌ Error:", err.response?.status, err.response?.data?.error?.message || err.message);
}
