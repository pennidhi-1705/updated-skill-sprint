import pg from "pg";
const { Pool } = pg;

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

export function requireDb(req, res, next) {
  if (!pool) return res.status(503).json({ error: "Database is not configured. The frontend prototype can still run locally." });
  next();
}