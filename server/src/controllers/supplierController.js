const Supplier = require("../models/Supplier");
const { loadPharmaCsvRows } = require("../data/pharmaCatalog");

const parseBool = (v) => String(v).toLowerCase() === "true";
const pct100 = (v) => Math.max(0, Math.min(100, Math.round(parseFloat(v) * 100)));
const pct1 = (v) => Math.max(0, Math.min(100, Math.round(parseFloat(v) * 100) / 100));
const num = (v, def = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : def; };

// ── List / search ─────────────────────────────────────────────────────────────
const listSuppliers = async (req, res) => {
  const { search = "", country = "", tier = "", risk = "", page = "1", limit = "50" } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { supplier_id: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { country: { $regex: search, $options: "i" } },
    ];
  }
  if (country) filter.country = { $regex: country, $options: "i" };
  if (tier) filter.tier = Number(tier);
  if (risk) filter.risk_classification = risk;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [suppliers, total] = await Promise.all([
    Supplier.find(filter).sort({ composite_risk_score: -1 }).skip(skip).limit(limitNum).lean(),
    Supplier.countDocuments(filter),
  ]);

  res.json({ suppliers, total, page: pageNum, pages: Math.ceil(total / limitNum) });
};

// ── Get single ────────────────────────────────────────────────────────────────
const getSupplier = async (req, res) => {
  const supplier = await Supplier.findById(req.params.id).lean();
  if (!supplier) return res.status(404).json({ message: "Supplier not found" });
  res.json({ supplier });
};

// ── Create ───────────────────────────────────────────────────────────────────
const createSupplier = async (req, res) => {
  const body = req.body;

  // Auto-generate supplier_id if not provided
  if (!body.supplier_id) {
    const count = await Supplier.countDocuments();
    body.supplier_id = `SUP-CUSTOM-${String(count + 1).padStart(4, "0")}`;
  }

  // Auto-generate name from supplier_id + country if not provided
  if (!body.name) {
    body.name = `${body.supplier_id} - ${body.country || "Unknown"} Tier ${body.tier || 2}`;
  }

  const supplier = await Supplier.create(body);
  res.status(201).json({ supplier });
};

// ── Update ───────────────────────────────────────────────────────────────────
const updateSupplier = async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(
    req.params.id,
    { $set: req.body },
    { new: true, runValidators: true }
  ).lean();

  if (!supplier) return res.status(404).json({ message: "Supplier not found" });
  res.json({ supplier });
};

// ── Delete ───────────────────────────────────────────────────────────────────
const deleteSupplier = async (req, res) => {
  const supplier = await Supplier.findByIdAndDelete(req.params.id).lean();
  if (!supplier) return res.status(404).json({ message: "Supplier not found" });
  res.json({ message: "Supplier deleted" });
};

// ── Import from CSV ───────────────────────────────────────────────────────────
const importFromCsv = async (req, res) => {
  const { rows } = loadPharmaCsvRows();

  if (!rows || rows.length === 0) {
    return res.status(404).json({ message: "CSV file not found or is empty" });
  }

  const ops = rows.map((row) => {
    const tier = Math.max(1, Math.min(3, parseInt(row.tier, 10) || 2));
    const riskScore = Math.max(0, Math.min(100, num(row.composite_risk_score, 0)));
    const financialHealth = pct100(row.financial_health_score);
    const dependencyPct = pct100(row.dependency_pct);
    const countryRisk = Math.round(num(row.country_risk_level, 0) * 100);
    const capacity = Math.max(0, Math.round(num(row.production_capacity_units_month, 0)));
    const utilPct = Math.max(0, Math.min(100, Math.round(num(row.capacity_utilization_pct, 0) * 100)));
    const geoConc = Math.max(0, Math.min(100, Math.round(num(row.geographic_concentration_pct, 0) * 100)));
    const histDelay = Math.max(0, Math.min(100, Math.round(num(row.historical_delay_frequency_pct, 0) * 100)));
    const batchFail = Math.max(0, Math.min(100, Math.round(num(row.batch_failure_rate_pct, 0) * 100)));

    const doc = {
      supplier_id: row.supplier_id,
      name: `${row.supplier_id} — ${row.country || "Unknown"}, Tier ${tier}`,
      tier,
      country: row.country || "",
      country_risk_level: countryRisk,
      region: row.region || "",
      production_capacity: capacity,
      capacity_utilization_pct: utilPct,
      gmp_status: parseBool(row.gmp_status),
      fda_approved: parseBool(row.fda_approved),
      cold_chain_capable: parseBool(row.cold_chain_capable),
      avg_lead_time_days: num(row.avg_lead_time_days, 0),
      lead_time_volatility_days: num(row.lead_time_volatility_days, 0),
      historical_delay_frequency_pct: histDelay,
      batch_cycle_time_days: num(row.batch_cycle_time_days, 0),
      batch_failure_rate_pct: batchFail,
      financial_health_score: financialHealth,
      upstream_dependency_known: parseBool(row.upstream_dependency_known),
      dependency_pct: dependencyPct,
      is_sole_source: parseBool(row.is_sole_source),
      num_approved_alternates: Math.max(0, parseInt(row.num_approved_alternates, 10) || 0),
      contract_duration_months: num(row.contract_duration_months, 0),
      geographic_concentration_pct: geoConc,
      news_sentiment_score: num(row.news_sentiment_score, 0),
      port_congestion_risk: num(row.port_congestion_risk, 0),
      weather_risk_score: num(row.weather_risk_score, 0),
      geopolitical_tension_score: num(row.geopolitical_tension_score, 0),
      active_disruption_signal: parseBool(row.active_disruption_signal),
      cold_chain_route_mismatch: parseBool(row.cold_chain_route_mismatch),
      compliance_violation_flag: parseBool(row.compliance_violation_flag),
      composite_risk_score: riskScore,
      risk_classification: (row.risk_classification || "moderate").toLowerCase(),
      imported_from_csv: true,
    };

    return {
      updateOne: {
        filter: { supplier_id: row.supplier_id },
        update: { $set: doc },
        upsert: true,
      },
    };
  });

  const result = await Supplier.bulkWrite(ops, { ordered: false });

  res.json({
    message: `Imported ${result.upsertedCount} new, updated ${result.modifiedCount} existing suppliers from CSV.`,
    total: rows.length,
    upserted: result.upsertedCount,
    modified: result.modifiedCount,
  });
};

// ── Delete all (clear) ────────────────────────────────────────────────────────
const clearSuppliers = async (req, res) => {
  await Supplier.deleteMany({});
  res.json({ message: "All supplier records deleted" });
};

module.exports = {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  importFromCsv,
  clearSuppliers,
};
