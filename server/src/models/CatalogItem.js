const mongoose = require("mongoose");

const CATALOG_NODE_TYPES = [
  "RawMaterialSource",
  "Tier3Supplier",
  "Tier2Supplier",
  "Tier1Supplier",
  "Manufacturer",
  "Warehouse",
  "ColdStorage",
  "Distributor",
  "Retailer",
];

const catalogItemSchema = new mongoose.Schema(
  {
    catalogId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      enum: CATALOG_NODE_TYPES,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: { type: String, default: "", trim: true },
    region: { type: String, default: "", trim: true },
    capacity: { type: Number, default: 0, min: 0 },
    inventory: { type: Number, default: 0, min: 0 },
    risk_score: { type: Number, default: 0, min: 0, max: 100 },
    lead_time_days: { type: Number, default: 0, min: 0 },
    reliability_score: { type: Number, default: 0, min: 0, max: 100 },
    dependency_percentage: { type: Number, default: 0, min: 0, max: 100 },
    compliance_status: { type: String, default: "Unknown", trim: true },
    gmp_status: {
      type: String,
      enum: ["Certified", "Pending", "Non-Compliant", "Unknown"],
      default: "Unknown",
    },
    fda_approval: {
      type: String,
      enum: ["Approved", "Pending", "Not Required", "Rejected", "Unknown"],
      default: "Unknown",
    },
    cold_chain_capable: { type: Boolean, default: false },
    cost: { type: Number, default: 0, min: 0 },
    moq: { type: Number, default: 0, min: 0 },
    contract_duration_months: { type: Number, default: 0, min: 0 },
    batch_cycle_time_days: { type: Number, default: 0, min: 0 },
    financial_health_score: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

module.exports = {
  CatalogItem: mongoose.model("CatalogItem", catalogItemSchema),
  CATALOG_NODE_TYPES,
};
