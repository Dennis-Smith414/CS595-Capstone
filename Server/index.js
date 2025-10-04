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

const routesRouter = require("./routes/routes");

// Routers
app.use("/api/health", require("./routes/health"));
app.use("/api/dbinfo", require("./routes/dbinfo"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/routes", require("./routes/routes"));  // list, :id.geojson, :id.gpx
app.use("/api", require("./routes/gpx"));           // if gpx.js exposes additional /api endpoints


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

const { init } = require("./Postgres");  // ← import init

if (require.main === module) {
  boot()
    .then(() => init())                  // ← ensure schema is ready
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
