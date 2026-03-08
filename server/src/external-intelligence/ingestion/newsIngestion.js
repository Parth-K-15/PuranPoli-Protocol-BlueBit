const { fetchNewsArticles } = require("../services/newsService");
const { detectKeywords } = require("../detection/keywordEngine");
const { detectCountry } = require("../detection/countryDetector");
const { analyseSentiment } = require("../detection/sentimentEngine");
const { scoreNewsSignal } = require("../scoring/disruptionScorer");
const DisruptionEvent = require("../../models/disruptionEvent");

/**
 * Full news ingestion pipeline:
 *  fetch → keyword detect → country detect → sentiment → score → aggregate → store
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
    const country = detectCountry(text);

    analysed.push({
      title: article.title,
      url: article.url,
      source: article.source?.name || "Unknown",
      publishedAt: article.publishedAt,
      event_type: kwResult.event_type,
      matched_keywords: kwResult.matched_keywords,
      keyword_intensity: kwResult.keyword_intensity_score,
      sentiment_compound: sentiment.compound,
      country: country?.name || "Global",
      location: country?.capital || "Global",
    });
  }

  if (!analysed.length) {
    console.log("[NewsIngestion] No relevant signals detected.");
    return [];
  }

  // ── Aggregation: group by country + event_type ──────────────────────────────
  const groups = {};
  for (const a of analysed) {
    const key = `${a.country}::${a.event_type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }

  // ── Create disruption events ────────────────────────────────────────────────
  const saved = [];
  for (const [compositeKey, items] of Object.entries(groups)) {
    const [country, eventType] = compositeKey.split("::");
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
        country: country,
        detected_at: { $gte: startOfDay() },
      },
      {
        $set: {
          severity_score: severity,
          description: buildDescription(eventType, items, country),
          raw_source_url: items[0].url,
          location: items[0].location,
          country: country,
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

function buildDescription(eventType, items, country) {
  const label = eventType.replace(/_/g, " ");
  const region = country !== "Global" ? ` in ${country}` : "";
  return `${items.length} article(s) detected for ${label}${region}. Top keywords: ${[
    ...new Set(items.flatMap((i) => i.matched_keywords)),
  ].join(", ")}`;
}

module.exports = { ingestNews };
