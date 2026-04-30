import express from "express";
import { webhookHandler } from "../controllers/webhook.controller.js";

const router = express.Router();

router.get("/webhook/health", (req, res) => {
  res.json({ status: "ok", module: "webhook" });
});

// Main webhook endpoint — clients call this to get AI replies
router.post("/webhook", webhookHandler);

export default router;
