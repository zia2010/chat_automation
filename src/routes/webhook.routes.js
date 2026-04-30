import express from "express";

const router = express.Router();

router.get("/webhook/health", (req, res) => {
  res.json({ status: "ok", module: "webhook" });
});

export default router;
