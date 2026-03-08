const cron = require("node-cron");
const { ingestNews } = require("../ingestion/newsIngestion");
const { ingestWeather } = require("../ingestion/weatherIngestion");
const { ingestGoogleNews } = require("../ingestion/gdeltIngestion");

/**
 * Register all cron jobs for external signal ingestion.
 *
 * Intervals:
 *   NewsAPI  → every 30 minutes
 *   Weather  → every 60 minutes
 *   GDELT    → every 45 minutes
 */
const startScheduler = () => {
  // ── NewsAPI — every 30 min ──────────────────────────────────────────────────
  cron.schedule("*/30 * * * *", async () => {
    try {
      await ingestNews();
    } catch (err) {
      console.error("[Scheduler] News ingestion failed:", err.message);
    }
  });

  // ── Weather — every 60 min ──────────────────────────────────────────────────
  cron.schedule("0 * * * *", async () => {
    try {
      await ingestWeather();
    } catch (err) {
      console.error("[Scheduler] Weather ingestion failed:", err.message);
    }
  });

  // ── Google News RSS — every 45 min ──────────────────────────────────────
  cron.schedule("*/45 * * * *", async () => {
    try {
      await ingestGoogleNews();
    } catch (err) {
      console.error("[Scheduler] Google News ingestion failed:", err.message);
    }
  });

  console.log("[Scheduler] Ingestion cron jobs registered.");
};

/**
 * Run all ingestion pipelines once (for manual / startup trigger).
 */
const runAllNow = async () => {
  const results = await Promise.allSettled([
    ingestNews(),
    ingestWeather(),
    ingestGoogleNews(),
  ]);
  results.forEach((r, i) => {
    const label = ["News", "Weather", "Google News"][i];
    if (r.status === "rejected") {
      console.error(`[Scheduler] ${label} one-shot failed:`, r.reason?.message);
    }
  });
  return results;
};

module.exports = { startScheduler, runAllNow };
