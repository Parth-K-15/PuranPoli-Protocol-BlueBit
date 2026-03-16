const mongoose = require("mongoose");

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    nodeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    edgeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ── Ownership ───────────────────────────────────────────
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // ── Publishing ──────────────────────────────────────────
    isPublished: {
      type: Boolean,
      default: false,
    },
    publisherName: {
      type: String,
      default: "",
      trim: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    importCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

workspaceSchema.index({ isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model("Workspace", workspaceSchema);
