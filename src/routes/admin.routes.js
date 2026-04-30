import express from "express";
import { validateAdmin } from "../middleware/adminAuth.js";
import { supabase } from "../db/supabase.js";

const router = express.Router();

// health — no auth needed
router.get("/admin/health", (req, res) => {
  res.json({ status: "ok", module: "admin" });
});

// test auth — protected route to verify middleware works
router.get("/admin/auth-check", validateAdmin, (req, res) => {
  res.json({ status: "ok", message: "Admin authenticated" });
});

// db connection check — protected
router.get("/admin/db-check", validateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from("clients").select("id").limit(1);
    if (error) throw error;
    res.json({ status: "ok", message: "DB connected", rows: data.length });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;
