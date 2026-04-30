export const validateAdmin = (req, res, next) => {
  const adminKey = req.headers["x-admin-key"];

  if (!adminKey || adminKey !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
};
