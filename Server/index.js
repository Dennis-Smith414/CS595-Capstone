// Server/index.js
require("dotenv").config({ path: __dirname + "/.env", override: true });

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

// Guard: ok if tests inject their own DATABASE_URL later
if (!process.env.DATABASE_URL) {
  console.warn("[boot] ⚠️ No DATABASE_URL yet (tests may set it).");
}

const PORT = process.env.PORT || 5100;
const app = express();

app.use(cors());
app.use(express.json());

// Routes
const gpxRoutes = require("./routes/gpx");
const authRoutes = require("./routes/auth");
app.use("/api", gpxRoutes);
app.use("/api/auth", authRoutes);

// Health
app.get("/api/health", (req, res) => {
  res.json({ ok: true, db: true, startedAt: new Date().toISOString() });
});

// Boot only does the DB connectivity check now
async function boot() {
  if (!process.env.DATABASE_URL) {
    throw new Error("No DATABASE_URL set");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await pool.query("SELECT NOW()");
    console.log("[boot] ✅ DB connection OK, time:", r.rows[0].now);
  } finally {
    await pool.end();
  }
}

// Only start the HTTP listener when run directly
if (require.main === module) {
  boot()
    .then(() => {
      app.listen(PORT, () =>
        console.log(`🚀 Backend listening on http://localhost:${PORT}`)
      );
    })
    .catch((err) => {
      console.error("[boot] ❌", err);
      process.exit(1);
    });
}

// Export for tests
module.exports = { app, boot };
