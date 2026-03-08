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
  },
  { timestamps: true }
);

module.exports = {
  Node: mongoose.model("Node", nodeSchema),
  NODE_TYPES,
};
