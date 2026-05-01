import "dotenv/config";
import express from "express";
import adminRoutes from "./routes/admin.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import { checkGeminiHealth } from "./services/aiHealth.service.js";

const app = express();
app.use(express.json());

app.use("/", adminRoutes);
app.use("/", webhookRoutes);

/**
 * startServer()
 *
 * Why a function instead of just app.listen()?
 * - We need to run an async health check BEFORE starting
 * - app.listen() alone can't wait for async operations
 * - This function: check AI → then start listening
 *
 * Flow:
 * 1. If AI_PROVIDER=gemini → test Gemini connection first
 *    - Healthy? → great, continue
 *    - Unhealthy + production? → crash (don't serve broken AI)
 *    - Unhealthy + development? → warn but continue
 * 2. If AI_PROVIDER=mock → skip check (mock always works)
 * 3. Start listening on port 3000
 */
const startServer = async () => {
  // Only check health if using Gemini (mock doesn't need a check)
  if (process.env.AI_PROVIDER === "gemini") {
    console.log("🔍 Checking Gemini connection...");

    const isHealthy = await checkGeminiHealth();

    if (!isHealthy) {
      console.error("❌ Gemini health check failed!");

      // In production, don't start with broken AI
      if (process.env.NODE_ENV === "production") {
        console.error("🛑 Shutting down — cannot run without AI in production");
        process.exit(1);
      }

      // In development, warn but keep going
      console.warn("⚠️ Continuing in dev mode with potentially broken Gemini");
    } else {
      console.log("✅ Gemini is healthy and ready!");
    }
  }

  app.listen(3000, () => {
    console.log("🚀 Server running on port 3000");
    console.log("📡 AI Provider:", process.env.AI_PROVIDER || "mock");
    console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "loaded" : "MISSING");
  });
};

startServer();
