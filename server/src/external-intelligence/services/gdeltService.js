const Parser = require("rss-parser");

const parser = new Parser();

const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";

// Supply-chain / pharma disruption queries
const QUERIES = [
  "pharmaceutical supply chain disruption",
  "factory fire chemical plant",
  "port strike congestion",
  "export ban sanctions trade",
  "labor protest factory shutdown",
  "drug shortage pharmaceutical",
  "logistics disruption shipping delay",
];

// In-memory cache — one entry per query
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

/**
 * Fetch Google News RSS articles for a single query string.
 */
const fetchGoogleNewsByQuery = async (query) => {
  const cached = cache.get(query);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = `${GOOGLE_NEWS_RSS}?q=${encodeURIComponent(query)}&hl=en&gl=US&ceid=US:en`;
  const feed = await parser.parseURL(url);
  const items = (feed.items || []).map((item) => ({
    title: item.title || "",
    link: item.link || "",
    source: item.creator || item.source || extractSource(item.title),
    pubDate: item.pubDate || item.isoDate || "",
    snippet: item.contentSnippet || item.content || "",
    query,
  }));

  cache.set(query, { data: items, ts: Date.now() });
  return items;
};

/**
 * Fetch articles for all supply-chain queries and return a deduplicated array.
 */
const fetchGoogleNewsArticles = async () => {
  const results = await Promise.allSettled(
    QUERIES.map((q) => fetchGoogleNewsByQuery(q))
  );

  const seen = new Set();
  const articles = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value) {
      if (seen.has(item.link)) continue;
      seen.add(item.link);
      articles.push(item);
    }
  }

  return articles;
};

function extractSource(title) {
  // Google News titles often end with " - SourceName"
  const match = title && title.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : "Google News";
}

module.exports = { fetchGoogleNewsArticles, fetchGoogleNewsByQuery };
