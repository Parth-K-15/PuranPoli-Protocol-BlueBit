const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    supplier_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tier: {
      type: Number,
      enum: [1, 2, 3],
      default: 2,
    },
    country: { type: String, default: "", trim: true },
    country_risk_level: { type: Number, default: 0, min: 0, max: 100 },
    region: { type: String, default: "", trim: true },
    production_capacity: { type: Number, default: 0, min: 0 },
    capacity_utilization_pct: { type: Number, default: 0, min: 0, max: 100 },
    gmp_status: { type: Boolean, default: false },
    fda_approved: { type: Boolean, default: false },
    cold_chain_capable: { type: Boolean, default: false },
    avg_lead_time_days: { type: Number, default: 0, min: 0 },
    lead_time_volatility_days: { type: Number, default: 0, min: 0 },
    historical_delay_frequency_pct: { type: Number, default: 0, min: 0, max: 100 },
    batch_cycle_time_days: { type: Number, default: 0, min: 0 },
    batch_failure_rate_pct: { type: Number, default: 0, min: 0, max: 100 },
    financial_health_score: { type: Number, default: 0, min: 0, max: 100 },
    upstream_dependency_known: { type: Boolean, default: false },
    dependency_pct: { type: Number, default: 0, min: 0, max: 100 },
    is_sole_source: { type: Boolean, default: false },
    num_approved_alternates: { type: Number, default: 0, min: 0 },
    contract_duration_months: { type: Number, default: 0, min: 0 },
    geographic_concentration_pct: { type: Number, default: 0, min: 0, max: 100 },
    news_sentiment_score: { type: Number, default: 0, min: -1, max: 1 },
    port_congestion_risk: { type: Number, default: 0, min: 0, max: 1 },
    weather_risk_score: { type: Number, default: 0, min: 0, max: 1 },
    geopolitical_tension_score: { type: Number, default: 0, min: 0, max: 1 },
    active_disruption_signal: { type: Boolean, default: false },
    cold_chain_route_mismatch: { type: Boolean, default: false },
    compliance_violation_flag: { type: Boolean, default: false },
    composite_risk_score: { type: Number, default: 0, min: 0, max: 100 },
    risk_classification: {
      type: String,
      enum: ["low", "moderate", "high", "critical", ""],
      default: "moderate",
    },
    // Source flag: true = imported from CSV, false = user-created
    imported_from_csv: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for fast lookup by country and tier
supplierSchema.index({ country: 1 });
supplierSchema.index({ tier: 1 });
supplierSchema.index({ composite_risk_score: -1 });

module.exports = mongoose.model("Supplier", supplierSchema);
