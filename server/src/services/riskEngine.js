/**
 * Risk Computation Engine
 *
 * Maps external disruption events to supply-chain nodes (by country)
 * and computes a composite risk score merging internal attributes + external signals.
 *
 * Composite Risk =
 *   (w1 × InternalRisk) + (w2 × ExternalRisk)
 *
 * Internal Risk factors:
 *   - Reliability gap        (100 - reliability_score)
 *   - Dependency pressure     dependency_percentage
 *   - Compliance penalty      Non-Compliant → 100, Watchlist → 50, else 0
 *   - GMP penalty             Non-Compliant → 80, Pending → 30, else 0
 *   - FDA penalty             Rejected → 80, Pending → 30, else 0
 *   - Financial weakness      (100 - financial_health_score)
 *
 * External Risk:
 *   - Average severity_score of disruptions matching node's country (last 48h)
 *
 * Risk Probability:
 *   0-30 → Low | 31-60 → Moderate | 61-80 → High | 81-100 → Critical
 */

const { Node } = require("../models/Node");
const DisruptionEvent = require("../models/disruptionEvent");
const { getCountryByName } = require("../external-intelligence/detection/countryDetector");
const { fetchWeatherByCity } = require("../external-intelligence/services/weatherService");
const { fetchGoogleNewsByQuery } = require("../external-intelligence/services/gdeltService");
const { analyseSentiment } = require("../external-intelligence/detection/sentimentEngine");
const { scoreWeatherSignal } = require("../external-intelligence/scoring/disruptionScorer");

// ── Weights ─────────────────────────────────────────────────────────────────
const W_INTERNAL = 0.55;
const W_EXTERNAL = 0.45;

// Internal sub-weights (must sum to 1)
const INTERNAL_WEIGHTS = {
  reliability: 0.2,
  dependency: 0.2,
  compliance: 0.15,
  gmp: 0.15,
  fda: 0.15,
  financial: 0.15,
};

// ── Helpers ─────────────────────────────────────────────────────────────────
function compliancePenalty(status) {
  if (status === "Non-Compliant") return 100;
  if (status === "Watchlist") return 50;
  return 0;
}

function gmpPenalty(status) {
  if (status === "Non-Compliant") return 100;
  if (status === "Pending") return 40;
  return 0;
}

function fdaPenalty(status) {
  if (status === "Rejected") return 100;
  if (status === "Pending") return 40;
  return 0;
}

function toProbability(score) {
  if (score <= 30) return "Low";
  if (score <= 60) return "Moderate";
  if (score <= 80) return "High";
  return "Critical";
}

// ── Internal risk (0-100) ───────────────────────────────────────────────────
function calcInternalRisk(node) {
  const reliability = 100 - (node.reliability_score || 0);
  const dependency = node.dependency_percentage || 0;
  const compliance = compliancePenalty(node.compliance_status);
  const gmp = gmpPenalty(node.gmp_status);
  const fda = fdaPenalty(node.fda_approval);
  const financial = 100 - (node.financial_health_score || 0);

  return (
    INTERNAL_WEIGHTS.reliability * reliability +
    INTERNAL_WEIGHTS.dependency * dependency +
    INTERNAL_WEIGHTS.compliance * compliance +
    INTERNAL_WEIGHTS.gmp * gmp +
    INTERNAL_WEIGHTS.fda * fda +
    INTERNAL_WEIGHTS.financial * financial
  );
}

// ── Fetch recent disruptions grouped by country ─────────────────────────────
async function getDisruptionsByCountry(hoursAgo = 48) {
  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  const disruptions = await DisruptionEvent.find({
    detected_at: { $gte: since },
  }).lean();

  const byCountry = {};
  for (const d of disruptions) {
    const key = (d.country || "").toLowerCase().trim();
    if (!key || key === "unknown") continue;
    if (!byCountry[key]) byCountry[key] = [];
    byCountry[key].push(d);
  }
  return byCountry;
}

// ── External risk for a node (0-100) ────────────────────────────────────────
function calcExternalRisk(node, disruptionMap) {
  const key = (node.country || "").toLowerCase().trim();
  const matched = disruptionMap[key];
  if (!matched || matched.length === 0) return 0;

  const avgSeverity =
    matched.reduce((sum, d) => sum + (d.severity_score || 0), 0) / matched.length;
  return Math.min(Math.round(avgSeverity), 100);
}

// ── Compute risk for all nodes (or filtered set) ────────────────────────────
async function computeAllNodeRisks(filter = {}) {
  const nodes = await Node.find(filter).lean();
  const disruptionMap = await getDisruptionsByCountry(48);

  const bulkOps = [];
  const results = [];

  for (const node of nodes) {
    const internal = calcInternalRisk(node);
    const external = calcExternalRisk(node, disruptionMap);
    const composite = Math.round(W_INTERNAL * internal + W_EXTERNAL * external);
    const clamped = Math.min(Math.max(composite, 0), 100);
    const probability = toProbability(clamped);

    bulkOps.push({
      updateOne: {
        filter: { _id: node._id },
        update: {
          $set: {
            risk_score: clamped,
            external_risk_score: external,
            risk_probability: probability,
            last_risk_update: new Date(),
          },
        },
      },
    });

    results.push({
      id: node.id,
      name: node.name,
      type: node.type,
      country: node.country,
      internal_risk: Math.round(internal),
      external_risk: external,
      risk_score: clamped,
      risk_probability: probability,
      matched_disruptions: (disruptionMap[(node.country || "").toLowerCase().trim()] || []).length,
    });
  }

  if (bulkOps.length > 0) {
    await Node.bulkWrite(bulkOps);
  }

  return results;
}

// ── Get disruptions affecting a specific node ───────────────────────────────
async function getDisruptionsForNode(nodeId, hoursAgo = 48) {
  const node = await Node.findOne({ id: nodeId }).lean();
  if (!node) return { node: null, disruptions: [] };

  const since = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
  const country = (node.country || "").trim();

  const disruptions = country
    ? await DisruptionEvent.find({
        country: new RegExp(`^${country}$`, "i"),
        detected_at: { $gte: since },
      })
        .sort({ severity_score: -1 })
        .limit(20)
        .lean()
    : [];

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      country: node.country,
      risk_score: node.risk_score,
      risk_probability: node.risk_probability,
      external_risk_score: node.external_risk_score,
    },
    disruptions,
  };
}

// ── Comprehensive intelligence for a single node ────────────────────────────
async function getNodeIntelligence(nodeId) {
  const node = await Node.findOne({ id: nodeId }).lean();
  if (!node) return null;

  const country = (node.country || "").trim();
  const countryInfo = getCountryByName(country);

  // 1. Disruptions from DB
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const disruptions = country
    ? await DisruptionEvent.find({
        country: new RegExp(`^${country}$`, "i"),
        detected_at: { $gte: since },
      })
        .sort({ severity_score: -1 })
        .limit(20)
        .lean()
    : [];

  // 2. Internal + external risk breakdown
  const disruptionMap = await getDisruptionsByCountry(48);
  const internal_risk = Math.round(calcInternalRisk(node));
  const disruption_risk = calcExternalRisk(node, disruptionMap);

  // 3. Weather (live fetch) + weather severity
  let weather = null;
  let weather_severity = 0;
  if (countryInfo) {
    const city = countryInfo.capital;
    const raw = await fetchWeatherByCity(city, countryInfo.code);
    if (raw) {
      const desc = raw.weather?.[0]?.description || "";
      weather = {
        city: raw.name || city,
        country: country,
        temp: raw.main?.temp,
        feels_like: raw.main?.feels_like,
        humidity: raw.main?.humidity,
        wind_speed: raw.wind?.speed,
        description: desc,
        icon: raw.weather?.[0]?.icon || null,
        rain_mm: raw.rain?.["1h"] || raw.rain?.["3h"] || 0,
        alerts: raw.alerts || [],
      };
      weather_severity = scoreWeatherSignal({
        wind_speed: weather.wind_speed,
        rain_mm: weather.rain_mm,
        temp_c: weather.temp,
        alerts: weather.alerts,
        description: desc,
      });
    }
  }

  // External risk = max(disruption-based, weather-based) so severe weather fully impacts risk
  const external_risk = Math.min(100, Math.max(disruption_risk, weather_severity));
  const composite = Math.round(W_INTERNAL * internal_risk + W_EXTERNAL * external_risk);
  const probability = toProbability(Math.min(Math.max(composite, 0), 100));

  // 4. Live news for this country (positive + negative)
  let news = { positive: [], negative: [], neutral: [] };
  try {
    const query = `${country} pharmaceutical OR supply chain OR factory OR sanctions OR trade`;
    const articles = await fetchGoogleNewsByQuery(query);
    for (const art of (articles || []).slice(0, 20)) {
      const text = `${art.title} ${art.snippet || ""}`;
      const sent = analyseSentiment(text);
      const item = {
        title: art.title,
        url: art.link,
        source: art.source || "Google News",
        publishedAt: art.pubDate,
        sentiment: Math.round(sent.compound * 100) / 100,
      };
      if (sent.compound > 0.1) news.positive.push(item);
      else if (sent.compound < -0.3) news.negative.push(item);
      else news.neutral.push(item);
    }
  } catch {
    // Live news fetch is best-effort
  }

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      country: node.country,
      region: node.region,
      risk_score: node.risk_score,
      risk_probability: node.risk_probability,
      external_risk_score: node.external_risk_score,
      last_risk_update: node.last_risk_update,
    },
    risk: {
      internal_risk,
      external_risk,
      disruption_risk,
      weather_severity,
      composite: Math.min(Math.max(composite, 0), 100),
      probability,
      factors: {
        reliability_gap: 100 - (node.reliability_score || 0),
        dependency: node.dependency_percentage || 0,
        compliance: node.compliance_status,
        gmp: node.gmp_status,
        fda: node.fda_approval,
        financial_weakness: 100 - (node.financial_health_score || 0),
      },
    },
    disruptions,
    weather,
    news,
  };
}

module.exports = {
  computeAllNodeRisks,
  getDisruptionsForNode,
  getNodeIntelligence,
  toProbability,
  calcInternalRisk,
  calcExternalRisk,
};
