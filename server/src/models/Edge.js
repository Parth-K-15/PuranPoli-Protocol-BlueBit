const mongoose = require("mongoose");

const edgeSchema = new mongoose.Schema(
  {
    edge_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    source_node: {
      type: String,
      required: true,
      trim: true,
    },
    target_node: {
      type: String,
      required: true,
      trim: true,
    },
    material: {
      type: String,
      default: "",
      trim: true,
    },
    lead_time: {
      type: Number,
      default: 0,
      min: 0,
    },
    dependency_percent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    transport_mode: {
      type: String,
      default: "",
      trim: true,
    },
    risk_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Edge", edgeSchema);
