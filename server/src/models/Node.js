const mongoose = require("mongoose");

const NODE_TYPES = [
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

const nodeSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: NODE_TYPES,
      required: true,
    },
    country: {
      type: String,
      default: "",
      trim: true,
    },
    region: {
      type: String,
      default: "",
      trim: true,
    },
    capacity: {
      type: Number,
      default: 0,
      min: 0,
    },
    inventory: {
      type: Number,
      default: 0,
      min: 0,
    },
    risk_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lead_time_days: {
      type: Number,
      default: 0,
      min: 0,
    },
    reliability_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    dependency_percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    compliance_status: {
      type: String,
      default: "Unknown",
      trim: true,
    },
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
    cold_chain_capable: {
      type: Boolean,
      default: false,
    },
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    moq: {
      type: Number,
      default: 0,
      min: 0,
    },
    contract_duration_months: {
      type: Number,
      default: 0,
      min: 0,
    },
    batch_cycle_time_days: {
      type: Number,
      default: 0,
      min: 0,
    },
    financial_health_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // ── Computed risk fields (set by risk engine) ─────────────
    risk_probability: {
      type: String,
      enum: ["Low", "Moderate", "High", "Critical"],
      default: "Low",
    },
    external_risk_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    last_risk_update: {
      type: Date,
      default: null,
    },
    position: {
      x: {
        type: Number,
        default: 0,
      },
      y: {
        type: Number,
        default: 0,
      },
    },
    linkedWorkspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    // ── Import tracking ─────────────────────────────────────
    imported: {
      type: Boolean,
      default: false,
    },
    sourceWorkspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    originalNodeId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = {
  Node: mongoose.model("Node", nodeSchema),
  NODE_TYPES,
};
