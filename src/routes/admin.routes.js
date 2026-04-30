import express from "express";
import { validateAdmin } from "../middleware/adminAuth.js";
import { getSupabase } from "../db/supabase.js";
import { createClient, generateApiKeyHandler, updateClient, deleteClient } from "../controllers/admin.controller.js";

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
    const { data, error } = await getSupabase().from("clients").select("id").limit(1);
    if (error) throw error;
    res.json({ status: "ok", message: "DB connected", rows: data.length });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// CREATE CLIENT — adds a new client to the database
router.post("/admin/clients", validateAdmin, createClient);

// GENERATE API KEY — creates a secure key for a client
router.post("/admin/api-key", validateAdmin, generateApiKeyHandler);

// UPDATE CLIENT — change client config (tokens, prompt, etc.)
router.put("/admin/clients/:clientId", validateAdmin, updateClient);

// DELETE CLIENT — remove a client and their data permanently
router.delete("/admin/clients/:clientId", validateAdmin, deleteClient);

export default router;
