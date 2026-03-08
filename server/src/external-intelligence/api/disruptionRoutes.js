const express = require("express");
const { StatusCodes } = require("http-status-codes");
const DisruptionEvent = require("../../models/disruptionEvent");
const { runAllNow } = require("../scheduler/ingestionScheduler");
const { fetchNewsArticles } = require("../services/newsService");
const { fetchAllWeather } = require("../services/weatherService");
const { fetchGoogleNewsArticles } = require("../services/gdeltService");

const router = express.Router();

// ── GET /api/v1/disruptions — list with optional filters ──────────────────────
router.get("/", async (req, res) => {
  const { country, source_type, event_type, limit = 50 } = req.query;
  const filter = {};

  if (country) filter.country = new RegExp(country, "i");
  if (source_type) filter.source_type = source_type;
  if (event_type) filter.event_type = event_type;

  const events = await DisruptionEvent.find(filter)
    .sort({ detected_at: -1, severity_score: -1 })
    .limit(Number(limit));

  res.json({ success: true, count: events.length, data: events });
});

// ── GET /api/v1/disruptions/high-risk — severity >= 60 ───────────────────────
router.get("/high-risk", async (req, res) => {
  const events = await DisruptionEvent.find({ severity_score: { $gte: 60 } })
    .sort({ severity_score: -1 })
    .limit(50);

  res.json({ success: true, count: events.length, data: events });
});

// ── GET /api/v1/disruptions/stats — summary counts ──────────────────────────
router.get("/stats", async (req, res) => {
  const [bySource, bySeverity, byType] = await Promise.all([
    DisruptionEvent.aggregate([
      { $group: { _id: "$source_type", count: { $sum: 1 }, avgSeverity: { $avg: "$severity_score" } } },
    ]),
    DisruptionEvent.aggregate([
      {
        $bucket: {
          groupBy: "$severity_score",
          boundaries: [0, 30, 60, 80, 101],
          default: "other",
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    DisruptionEvent.aggregate([
      { $group: { _id: "$event_type", count: { $sum: 1 }, avgSeverity: { $avg: "$severity_score" } } },
      { $sort: { avgSeverity: -1 } },
    ]),
  ]);

  res.json({ success: true, data: { bySource, bySeverity, byType } });
});

// ── POST /api/v1/disruptions/ingest — manual trigger ─────────────────────────
router.post("/ingest", async (req, res) => {
  await runAllNow();
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Ingestion triggered for all sources.",
  });
});

// ── GET /api/v1/disruptions/live/:source — raw API data for UI feed ──────────

router.get("/live/news", async (req, res) => {
  try {
    const articles = await fetchNewsArticles();
    res.json({ success: true, data: articles });
  } catch (err) {
    res.status(502).json({ success: false, message: "NewsAPI fetch failed", error: err.message });
  }
});

router.get("/live/weather", async (req, res) => {
  try {
    const data = await fetchAllWeather();
    res.json({ success: true, data });
  } catch (err) {
    res.status(502).json({ success: false, message: "Weather fetch failed", error: err.message });
  }
});

router.get("/live/google-news", async (req, res) => {
  try {
    const articles = await fetchGoogleNewsArticles();
    res.json({ success: true, count: articles.length, data: articles });
  } catch (err) {
    res.status(502).json({ success: false, message: "Google News RSS fetch failed", error: err.message });
  }
});

module.exports = router;
