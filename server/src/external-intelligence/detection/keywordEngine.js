// ── Keyword categories with weights ────────────────────────────────────────────

const CATEGORIES = {
  production_disruption: {
    weight: 0.9,
    keywords: [
      "factory shutdown",
      "production halt",
      "plant explosion",
      "chemical plant fire",
      "equipment failure",
      "manufacturing delay",
      "production stoppage",
      "plant closure",
    ],
  },
  logistics_disruption: {
    weight: 0.85,
    keywords: [
      "port congestion",
      "shipping delay",
      "container backlog",
      "dock strike",
      "port strike",
      "rail disruption",
      "air cargo shortage",
      "freight disruption",
      "transport delay",
    ],
  },
  raw_material_shortage: {
    weight: 0.8,
    keywords: [
      "raw material shortage",
      "chemical shortage",
      "api shortage",
      "export restriction",
      "mineral supply disruption",
      "supply shortage",
      "ingredient shortage",
    ],
  },
  geopolitical_risk: {
    weight: 0.75,
    keywords: [
      "sanctions",
      "trade ban",
      "political unrest",
      "labor protest",
      "border conflict",
      "export ban",
      "trade war",
      "government instability",
      "military conflict",
    ],
  },
};

/**
 * Scans text against all keyword categories.
 * @param {string} text — article title + description
 * @returns {{ event_type: string, matched_keywords: string[], keyword_intensity_score: number }}
 */
const detectKeywords = (text) => {
  if (!text) return null;

  const lower = text.toLowerCase();
  let bestMatch = null;

  for (const [eventType, category] of Object.entries(CATEGORIES)) {
    const matched = category.keywords.filter((kw) => lower.includes(kw));
    if (matched.length === 0) continue;

    // intensity = (matched / total) * category weight, scaled to 0-100
    const intensity =
      (matched.length / category.keywords.length) * category.weight * 100;

    if (!bestMatch || intensity > bestMatch.keyword_intensity_score) {
      bestMatch = {
        event_type: eventType,
        matched_keywords: matched,
        keyword_intensity_score: Math.round(intensity * 100) / 100,
      };
    }
  }

  return bestMatch;
};

module.exports = { detectKeywords, CATEGORIES };
