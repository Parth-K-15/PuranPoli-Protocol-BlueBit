const { fetchGoogleNewsArticles } = require("../services/gdeltService");
const { detectKeywords } = require("../detection/keywordEngine");
const { detectCountry } = require("../detection/countryDetector");
const { analyseSentiment } = require("../detection/sentimentEngine");
const { scoreNewsSignal } = require("../scoring/disruptionScorer");
const DisruptionEvent = require("../../models/disruptionEvent");

/**
 * Google News RSS ingestion pipeline:
 *  fetch articles → keyword detect → country detect → sentiment → score → aggregate → store
 */
const ingestGoogleNews = async () => {
  console.log("[GoogleNewsIngestion] Starting Google News RSS ingestion…");
  const articles = await fetchGoogleNewsArticles();

  if (!articles.length) {
    console.log("[GoogleNewsIngestion] No articles returned.");
    return [];
  }

  const analysed = [];
  for (const article of articles) {
    const text = `${article.title} ${article.snippet}`;
    const kwResult = detectKeywords(text);
    if (!kwResult) continue;

    const sentiment = analyseSentiment(text);
    const country = detectCountry(text);

    analysed.push({
      title: article.title,
      url: article.link,
      source: article.source || "Google News",
      publishedAt: article.pubDate,
      event_type: kwResult.event_type,
      matched_keywords: kwResult.matched_keywords,
      keyword_intensity: kwResult.keyword_intensity_score,
      sentiment_compound: sentiment.compound,
      country: country?.name || "Global",
      location: country?.capital || "Global",
    });
  }

  if (!analysed.length) {
    console.log("[GoogleNewsIngestion] No relevant signals detected.");
    return [];
  }

  // ── Aggregation by country + event_type ─────────────────────────────────────
  const groups = {};
  for (const a of analysed) {
    const key = `${a.country}::${a.event_type}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }

  const saved = [];
  for (const [compositeKey, items] of Object.entries(groups)) {
    const [country, eventType] = compositeKey.split("::");
    const avgKw =
      items.reduce((s, i) => s + i.keyword_intensity, 0) / items.length;
    const avgSentiment =
      items.reduce((s, i) => s + i.sentiment_compound, 0) / items.length;

    const severity = scoreNewsSignal({
      keyword_intensity: avgKw,
      sentiment_compound: avgSentiment,
      article_count: items.length,
    });

    const doc = await DisruptionEvent.findOneAndUpdate(
      {
        event_type: eventType,
        source_type: "google_news",
        country: country,
        detected_at: { $gte: startOfDay() },
      },
      {
        $set: {
          severity_score: severity,
          description: `${items.length} Google News article(s) for ${eventType.replace(/_/g, " ")}${country !== "Global" ? ` in ${country}` : ""}. Avg sentiment: ${avgSentiment.toFixed(2)}.`,
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
              publishedAt: i.publishedAt ? new Date(i.publishedAt) : new Date(),
              sentiment: i.sentiment_compound,
              matched_keywords: i.matched_keywords,
            })),
            $slice: -50,
          },
        },
      },
      { upsert: true, new: true }
    );

    saved.push(doc);
  }

  console.log(`[GoogleNewsIngestion] Stored ${saved.length} disruption event(s).`);
  return saved;
};

function startOfDay() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

module.exports = { ingestGoogleNews };
