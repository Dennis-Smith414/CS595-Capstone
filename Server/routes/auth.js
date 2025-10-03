const express = require("express");
const bcrypt = require("bcryptjs");
const { run, all } = require("../Postgres");

const router = express.Router();

const isNonEmpty = (s) => typeof s === "string" && s.trim().length > 0;
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const strongPwd = (s) =>
  typeof s === "string" && s.length >= 8 && /[A-Z]/.test(s) && /[^A-Za-z0-9]/.test(s);

router.post("/register", async (req, res) => {
  try {
    let { username, email, password } = req.body || {};
    username = (username || "").trim();
    email = (email || "").trim();

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

    // Uniqueness (case-insensitive)
    const existing = await all(
      `SELECT id FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($2)`,
      [username, email]
    );
    if (existing.length) {
      return res.status(409).json({ ok: false, error: "Username or email already in use." });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await run(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1,$2,$3)
       RETURNING id, username, email, create_time`,
      [username, email, password_hash]
    );

    const rows = result?.rows ?? []; // tolerate any wrapper
    return res.status(201).json({ ok: true, user: rows[0] });
  } catch (e) {
    // These logs make the 500 actionable
    console.error("POST /api/auth/register error:");
    console.error("  code:", e?.code);
    console.error("  message:", e?.message);
    console.error("  detail:", e?.detail);
    console.error("  stack:", e?.stack);
    if (e?.code === "23505") {
      // unique_violation if you add unique indexes
      return res.status(409).json({ ok: false, error: "Username or email already in use." });
    }
    return res.status(500).json({ ok: false, error: "Server error." });
  }
});

module.exports = router;
