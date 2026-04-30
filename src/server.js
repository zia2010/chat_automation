import express from "express";
import dotenv from "dotenv";
import adminRoutes from "./routes/admin.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/", adminRoutes);
app.use("/", webhookRoutes);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
