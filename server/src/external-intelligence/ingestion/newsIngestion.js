const { fetchNewsArticles } = require("../services/newsService");
const { detectKeywords } = require("../detection/keywordEngine");
const { analyseSentiment } = require("../detection/sentimentEngine");
const { scoreNewsSignal } = require("../scoring/disruptionScorer");
const DisruptionEvent = require("../../models/disruptionEvent");

/**
 * Full news ingestion pipeline:
 *  fetch → keyword detect → sentiment → score → aggregate → store
 */
const ingestNews = async () => {
  console.log("[NewsIngestion] Starting news ingestion…");
  const articles = await fetchNewsArticles();

  if (!articles.length) {
    console.log("[NewsIngestion] No articles returned.");
    return [];
  }

  // ── Per-article analysis ────────────────────────────────────────────────────
  const analysed = [];
  for (const article of articles) {
    const text = `${article.title || ""} ${article.description || ""}`;
    const kwResult = detectKeywords(text);
    if (!kwResult) continue; // Not supply-chain relevant

    const sentiment = analyseSentiment(text);

    analysed.push({
      title: article.title,
      url: article.url,
      source: article.source?.name || "Unknown",
      publishedAt: article.publishedAt,
      event_type: kwResult.event_type,
      matched_keywords: kwResult.matched_keywords,
      keyword_intensity: kwResult.keyword_intensity_score,
      sentiment_compound: sentiment.compound,
    });
  }

  if (!analysed.length) {
    console.log("[NewsIngestion] No relevant signals detected.");
    return [];
  }

  // ── Aggregation: group by event_type ────────────────────────────────────────
  const groups = {};
  for (const a of analysed) {
    const key = a.event_type;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }

  // ── Create disruption events ────────────────────────────────────────────────
  const saved = [];
  for (const [eventType, items] of Object.entries(groups)) {
    const avgKw =
      items.reduce((s, i) => s + i.keyword_intensity, 0) / items.length;
    const avgSent =
      items.reduce((s, i) => s + i.sentiment_compound, 0) / items.length;

    const severity = scoreNewsSignal({
      keyword_intensity: avgKw,
      sentiment_compound: avgSent,
      article_count: items.length,
    });

    const doc = await DisruptionEvent.findOneAndUpdate(
      {
        event_type: eventType,
        source_type: "news",
        detected_at: { $gte: startOfDay() },
      },
      {
        $set: {
          severity_score: severity,
          description: buildDescription(eventType, items),
          raw_source_url: items[0].url,
        },
        $push: {
          related_articles: {
            $each: items.map((i) => ({
              title: i.title,
              url: i.url,
              source: i.source,
              publishedAt: i.publishedAt,
              sentiment: i.sentiment_compound,
              matched_keywords: i.matched_keywords,
            })),
            $slice: -50, // keep last 50
          },
        },
        $setOnInsert: {
          location: "Global",
          country: "Multiple",
        },
      },
      { upsert: true, new: true }
    );

    saved.push(doc);
  }

  console.log(`[NewsIngestion] Stored ${saved.length} disruption event(s).`);
  return saved;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildDescription(eventType, items) {
  const label = eventType.replace(/_/g, " ");
  return `${items.length} article(s) detected for ${label}. Top keywords: ${[
    ...new Set(items.flatMap((i) => i.matched_keywords)),
  ].join(", ")}`;
}

module.exports = { ingestNews };
