const fs = require("fs");
const path = require("path");

const CSV_PATH = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "ML",
  "pharma_supply_chain_risk.csv"
);

const TIER_TYPE_MAP = {
  1: "Tier1Supplier",
  2: "Tier2Supplier",
  3: "Tier3Supplier",
};

const parseCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      // Escaped quote inside quoted field.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
};

const parseBool = (value) => String(value).toLowerCase() === "true";
const parseNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const loadPharmaCsvRows = () => {
  if (!fs.existsSync(CSV_PATH)) {
    return { headers: [], rows: [] };
  }

  const text = fs.readFileSync(CSV_PATH, "utf8");
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    const row = {};

    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });

    rows.push(row);
  }

  return { headers, rows };
};

const computeSchemaAnalysis = (headers, rows) => {
  const nullCounts = {};
  const numericMinMax = {};

  headers.forEach((h) => {
    nullCounts[h] = 0;
  });

  rows.forEach((row) => {
    headers.forEach((h) => {
      const value = row[h];
      if (value === undefined || value === null || String(value).trim() === "") {
        nullCounts[h] += 1;
      }
    });
  });

  const numericColumns = [
    "tier",
    "country_risk_level",
    "production_capacity_units_month",
    "capacity_utilization_pct",
    "avg_lead_time_days",
    "lead_time_volatility_days",
    "historical_delay_frequency_pct",
    "batch_cycle_time_days",
    "batch_failure_rate_pct",
    "financial_health_score",
    "dependency_pct",
    "num_approved_alternates",
    "contract_duration_months",
    "geographic_concentration_pct",
    "news_sentiment_score",
    "port_congestion_risk",
    "weather_risk_score",
    "geopolitical_tension_score",
    "composite_risk_score",
  ];

  numericColumns.forEach((col) => {
    const values = rows.map((r) => parseNumber(r[col], NaN)).filter((n) => Number.isFinite(n));
    if (values.length > 0) {
      numericMinMax[col] = {
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
  });

  const supplierIds = rows.map((r) => r.supplier_id).filter(Boolean);
  const uniqueSupplierIds = new Set(supplierIds);

  return {
    path: CSV_PATH,
    rowCount: rows.length,
    columns: headers,
    nullCounts,
    nullPercentages: Object.fromEntries(
      Object.entries(nullCounts).map(([k, v]) => [k, Number(((v / Math.max(rows.length, 1)) * 100).toFixed(2))])
    ),
    numericMinMax,
    constraints: {
      supplier_id_unique: uniqueSupplierIds.size === supplierIds.length,
      expected_tiers: [1, 2, 3],
      risk_classification_values: ["low", "moderate", "high", "critical"],
    },
  };
};

const toCatalogItem = (row, type, idx) => {
  const tier = parseNumber(row.tier, 2);
  const riskScore = Math.max(0, Math.min(100, parseNumber(row.composite_risk_score, 0)));
  const dependencyPct = Math.max(0, Math.min(100, parseNumber(row.dependency_pct, 0) * 100));
  const leadTime = parseNumber(row.avg_lead_time_days, 0);
  const financial = Math.max(0, Math.min(100, parseNumber(row.financial_health_score, 0) * 100));
  const reliability = Math.max(0, Math.min(100, Math.round(100 - riskScore * 0.55 + financial * 0.25 - leadTime * 0.2)));
  const capacity = Math.max(0, Math.round(parseNumber(row.production_capacity_units_month, 0)));
  const utilization = Math.max(0, Math.min(1, parseNumber(row.capacity_utilization_pct, 0)));
  const inventory = Math.max(0, Math.round(capacity * (1 - utilization) * 0.35));

  let complianceStatus = "Compliant";
  if (parseBool(row.compliance_violation_flag)) {
    complianceStatus = "Non-Compliant";
  } else if (riskScore >= 60) {
    complianceStatus = "Watchlist";
  }

  const gmpStatus = parseBool(row.gmp_status) ? "Certified" : "Pending";
  const fdaApproval = parseBool(row.fda_approved) ? "Approved" : "Pending";

  return {
    catalogId: `csv_${String(type).toLowerCase()}_${row.supplier_id || idx}`,
    name: `${row.supplier_id || "SUP"} - ${row.country || "Unknown"} Tier ${tier}`,
    country: row.country || "Unknown",
    region: row.region || "Unknown",
    capacity,
    inventory,
    risk_score: Number(riskScore.toFixed(2)),
    lead_time_days: Number(leadTime.toFixed(1)),
    reliability_score: Number(reliability.toFixed(2)),
    dependency_percentage: Number(dependencyPct.toFixed(2)),
    compliance_status: complianceStatus,
    gmp_status: gmpStatus,
    fda_approval: fdaApproval,
    cold_chain_capable: parseBool(row.cold_chain_capable),
    cost: Math.max(0, Math.round(capacity * (type === "Tier1Supplier" ? 12 : type === "Tier2Supplier" ? 9 : 7))),
    moq: Math.max(0, Math.round(capacity * 0.03)),
    contract_duration_months: parseNumber(row.contract_duration_months, 12),
    batch_cycle_time_days: parseNumber(row.batch_cycle_time_days, 0),
    financial_health_score: Number(financial.toFixed(2)),
  };
};

const buildCatalogFromCsv = (rows, perTier = 18) => {
  const byTier = {
    Tier1Supplier: [],
    Tier2Supplier: [],
    Tier3Supplier: [],
  };

  rows.forEach((row, idx) => {
    const mappedType = TIER_TYPE_MAP[parseNumber(row.tier, 0)];
    if (!mappedType) return;
    byTier[mappedType].push(toCatalogItem(row, mappedType, idx));
  });

  return {
    Tier1Supplier: byTier.Tier1Supplier.slice(0, perTier),
    Tier2Supplier: byTier.Tier2Supplier.slice(0, perTier),
    Tier3Supplier: byTier.Tier3Supplier.slice(0, perTier),
    // For now expose a subset of Tier3 suppliers as raw sources.
    RawMaterialSource: byTier.Tier3Supplier.slice(0, Math.min(8, perTier)).map((item, idx) => ({
      ...item,
      catalogId: `csv_raw_${idx + 1}`,
      name: `${item.name} - Raw Input`,
      type: "RawMaterialSource",
    })),
  };
};

const getPharmaCatalogAndSchema = () => {
  const { headers, rows } = loadPharmaCsvRows();
  const schemaAnalysis = computeSchemaAnalysis(headers, rows);
  const catalog = buildCatalogFromCsv(rows);

  return {
    csvPath: CSV_PATH,
    schemaAnalysis,
    catalog,
  };
};

module.exports = {
  getPharmaCatalogAndSchema,
  loadPharmaCsvRows,
};
