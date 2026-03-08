const mongoose = require("mongoose");

const disruptionEventSchema = new mongoose.Schema(
  {
    event_type: {
      type: String,
      required: true,
      index: true,
    },
    source_type: {
      type: String,
      enum: ["news", "weather", "google_news"],
      required: true,
    },
    location: { type: String, default: "Unknown" },
    country: { type: String, default: "Unknown", index: true },
    severity_score: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
      index: true,
    },
    detected_at: { type: Date, default: Date.now },
    description: { type: String, required: true },
    raw_source_url: String,
    related_articles: [
      {
        title: String,
        url: String,
        source: String,
        publishedAt: Date,
        sentiment: Number,
        matched_keywords: [String],
      },
    ],
  },
  { timestamps: true }
);

// Compound index for aggregation dedup
disruptionEventSchema.index({ location: 1, event_type: 1, detected_at: 1 });

module.exports = mongoose.model("DisruptionEvent", disruptionEventSchema);
