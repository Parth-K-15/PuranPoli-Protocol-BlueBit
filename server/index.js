require("dotenv").config();
require("express-async-errors");

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

const connectDB = require("./src/config/db");
const { connectNeo4j } = require("./src/config/neo4j");
const errorHandler = require("./src/middlewares/errorHandler");
const notFound = require("./src/middlewares/notFound");
const healthRoutes = require("./src/routes/healthRoutes");
const graphRoutes = require("./src/routes/graphRoutes");
const workspaceRoutes = require("./src/routes/workspaceRoutes");
const disruptionRoutes = require("./src/external-intelligence/api/disruptionRoutes");
const locationRoutes = require("./src/routes/locationRoutes");
const catalogRoutes = require("./src/routes/catalogRoutes");
const supplierRoutes = require("./src/routes/supplierRoutes");
const MonitoredLocation = require("./src/models/monitoredLocation");
const { startScheduler } = require("./src/external-intelligence/scheduler/ingestionScheduler");

const app = express();

// ── Security & Parsing Middleware ──────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Logger (dev only) ─────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/v1/health", healthRoutes);
app.use("/api/v1/workspaces", workspaceRoutes);
app.use("/api/v1", graphRoutes);
app.use("/api/v1/disruptions", disruptionRoutes);
app.use("/api/v1/locations", locationRoutes);
app.use("/api/v1", catalogRoutes);
app.use("/api/v1/suppliers", supplierRoutes);

// ── Error Handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  await MonitoredLocation.seedDefaults();
  await connectNeo4j();
  startScheduler();
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

start();
