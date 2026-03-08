const mongoose = require("mongoose");

const monitoredLocationSchema = new mongoose.Schema(
  {
    city: { type: String, required: true },
    country: { type: String, required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    category: {
      type: String,
      enum: ["pharma_hub", "port", "manufacturing", "logistics", "raw_material"],
      default: "pharma_hub",
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

monitoredLocationSchema.index({ city: 1, country: 1 }, { unique: true });

// Seed default pharma supply chain hubs if collection is empty
monitoredLocationSchema.statics.seedDefaults = async function () {
  const count = await this.countDocuments();
  if (count > 0) return;

  const defaults = [
    // Major pharma manufacturing & API hubs
    { city: "Shanghai", country: "China", lat: 31.23, lon: 121.47, category: "pharma_hub" },
    { city: "Mumbai", country: "India", lat: 19.08, lon: 72.88, category: "pharma_hub" },
    { city: "Hyderabad", country: "India", lat: 17.39, lon: 78.49, category: "pharma_hub" },
    { city: "Basel", country: "Switzerland", lat: 47.56, lon: 7.59, category: "pharma_hub" },
    { city: "Shenzhen", country: "China", lat: 22.54, lon: 114.06, category: "manufacturing" },
    { city: "Dublin", country: "Ireland", lat: 53.35, lon: -6.26, category: "pharma_hub" },
    { city: "Raleigh", country: "USA", lat: 35.78, lon: -78.64, category: "pharma_hub" },
    { city: "Tokyo", country: "Japan", lat: 35.68, lon: 139.69, category: "pharma_hub" },
    { city: "São Paulo", country: "Brazil", lat: -23.55, lon: -46.63, category: "pharma_hub" },
    // Key logistics / port cities
    { city: "Rotterdam", country: "Netherlands", lat: 51.92, lon: 4.48, category: "port" },
    { city: "Singapore", country: "Singapore", lat: 1.35, lon: 103.82, category: "port" },
    { city: "Houston", country: "USA", lat: 29.76, lon: -95.37, category: "port" },
    { city: "Hamburg", country: "Germany", lat: 53.55, lon: 9.99, category: "port" },
    { city: "Busan", country: "South Korea", lat: 35.18, lon: 129.08, category: "port" },
    { city: "Jebel Ali", country: "UAE", lat: 25.0, lon: 55.08, category: "port" },
    // Raw material sourcing regions
    { city: "Wuhan", country: "China", lat: 30.59, lon: 114.31, category: "raw_material" },
    { city: "Ahmedabad", country: "India", lat: 23.02, lon: 72.57, category: "raw_material" },
    { city: "Johannesburg", country: "South Africa", lat: -26.2, lon: 28.04, category: "raw_material" },
    { city: "Jakarta", country: "Indonesia", lat: -6.21, lon: 106.85, category: "manufacturing" },
    { city: "Mexico City", country: "Mexico", lat: 19.43, lon: -99.13, category: "manufacturing" },
  ];

  await this.insertMany(defaults);
  console.log(`[MonitoredLocation] Seeded ${defaults.length} default cities.`);
};

module.exports = mongoose.model("MonitoredLocation", monitoredLocationSchema);
