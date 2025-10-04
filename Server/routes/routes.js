// Server/routes/routes.js
const express = require("express");
const router = express.Router();
const { all, get } = require("../Postgres");

// GET /api/routes/list?limit=50
router.get("/list", async (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  try {
    const rows = await all(
      `SELECT id, slug, name, region, updated_at
         FROM routes
        ORDER BY updated_at DESC
        LIMIT $1`,
      [limit]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error("routes/list error:", e);
    res.status(500).json({ error: "Failed to fetch route list" });
  }
});

// GET /api/routes/:id.geojson  -> GeoJSON Feature
router.get("/:id.geojson", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Bad id" });

  try {
    // Adjust table/column names to your schema
    // geometry column must be a PostGIS geometry type
    const row = await get(
      `SELECT ST_AsGeoJSON(geometry)::json AS geometry
         FROM gpx
        WHERE route_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [id]
    );

    if (!row || !row.geometry) {
      return res.status(404).json({ error: "Route geometry not found" });
    }

    res.json({
      type: "Feature",
      properties: { route_id: id },
      geometry: row.geometry, // already JSON
    });
  } catch (e) {
    console.error(`geojson error route ${id}:`, e);
    res.status(500).json({ error: "Failed to fetch geojson" });
  }
});

// GET /api/routes/:id.gpx  -> raw GPX file
router.get("/:id.gpx", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).send("Bad id");

  try {
    const row = await get(
      `SELECT file
         FROM gpx
        WHERE route_id = $1
        ORDER BY created_at DESC
        LIMIT 1`,
      [id]
    );

    if (!row || !row.file) return res.status(404).send("GPX not found");

    res.setHeader("Content-Type", "application/gpx+xml");
    res.send(row.file.toString());
  } catch (e) {
    console.error(`gpx error route ${id}:`, e);
    res.status(500).send("Failed to fetch GPX");
  }
});

module.exports = router;
