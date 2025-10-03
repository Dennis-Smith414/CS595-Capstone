// Server/routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const { run, all } = require("../Postgres"); // ✅ reuse shared pool

const router = express.Router();

const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const strongPwd = (s) =>
  typeof s === "string" && s.length >= 8 && /[A-Z]/.test(s) && /[^A-Za-z0-9]/.test(s);
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    let { username, email, password } = req.body || {};
    username = (username || "").trim();
    email = (email || "").trim();

    // Basic validation
    if (!isNonEmpty(username) || !isNonEmpty(email) || !isNonEmpty(password)) {
      return res.status(400).json({ ok: false, error: "All fields are required." });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email format." });
    }
    if (!strongPwd(password)) {
      return res.status(400).json({
        ok: false,
        error: "Password must be ≥ 8 chars with 1 uppercase and 1 symbol.",
      });
    }

    // Uniqueness check (case-insensitive)
    const existing = await all(
      `SELECT id FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2)`,
      [username, email]
    );
    if (existing.length) {
      return res.status(409).json({ ok: false, error: "Username or email already in use." });
    }

    // Hash + insert (column is "password" per your Postgres.js schema)
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await run(
      `INSERT INTO users (username, email, password)
       VALUES ($1,$2,$3)
       RETURNING id, username, email, create_time`,
      [username, email, password_hash]
    );

    return res.status(201).json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error("POST /api/auth/register error:", e);
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

module.exports = router;
