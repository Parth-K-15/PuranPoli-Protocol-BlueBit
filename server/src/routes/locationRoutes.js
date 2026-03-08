const express = require("express");
const { StatusCodes } = require("http-status-codes");
const MonitoredLocation = require("../models/monitoredLocation");

const router = express.Router();

// ── GET /api/v1/locations — list all monitored cities ─────────────────────────
router.get("/", async (req, res) => {
  const { category, active } = req.query;
  const filter = {};
  if (category) filter.category = category;
  if (active !== undefined) filter.active = active === "true";

  const locations = await MonitoredLocation.find(filter).sort({ country: 1, city: 1 });
  res.json({ success: true, count: locations.length, data: locations });
});

// ── POST /api/v1/locations — add a new city ───────────────────────────────────
router.post("/", async (req, res) => {
  const { city, country, lat, lon, category } = req.body;
  if (!city || !country || lat == null || lon == null) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "city, country, lat, and lon are required.",
    });
  }

  const doc = await MonitoredLocation.create({ city, country, lat, lon, category });
  res.status(StatusCodes.CREATED).json({ success: true, data: doc });
});

// ── PATCH /api/v1/locations/:id — toggle active or update fields ──────────────
router.patch("/:id", async (req, res) => {
  const allowed = ["city", "country", "lat", "lon", "category", "active"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const doc = await MonitoredLocation.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!doc) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Location not found" });
  res.json({ success: true, data: doc });
});

// ── DELETE /api/v1/locations/:id — remove a city ──────────────────────────────
router.delete("/:id", async (req, res) => {
  const doc = await MonitoredLocation.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Location not found" });
  res.json({ success: true, message: `${doc.city} removed.` });
});

module.exports = router;
