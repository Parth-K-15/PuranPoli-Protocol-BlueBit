const axios = require("axios");
const { Node } = require("../models/Node");
const Edge = require("../models/Edge");

const ANALYTICS_URL = process.env.ANALYTICS_URL || "http://localhost:8001";

/**
 * POST /api/v1/simulation/run
 *
 * Fetches the supply chain graph from MongoDB, sends it to the Python ML
 * service along with the disruption parameters, and returns the simulation
 * result (affected nodes, cascade paths, financial impact).
 */
async function runSimulation(req, res) {
  const {
    disruption_type,
    target_node_id,
    severity = 50,
    duration_days = 7,
    revenue_per_day = 0,
    workspace,
  } = req.body;

  if (!disruption_type || !target_node_id) {
    return res
      .status(400)
      .json({ error: "disruption_type and target_node_id are required." });
  }

  try {
    // 1. Fetch graph from MongoDB
    const filter = workspace ? { workspace } : {};
    const nodes = await Node.find(filter).lean();
    const edges = await Edge.find(filter).lean();

    // 2. Transform to ML service payload
    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: "supplyNode",
        data: {
          name: n.name,
          type: n.type,
          country: n.country,
          region: n.region,
          capacity: n.capacity,
          inventory: n.inventory,
          risk_score: n.risk_score,
          lead_time_days: n.lead_time_days,
          reliability_score: n.reliability_score,
          dependency_percentage: n.dependency_percentage,
          compliance_status: n.compliance_status,
          gmp_status: n.gmp_status,
          fda_approval: n.fda_approval,
          cold_chain_capable: n.cold_chain_capable,
          cost: n.cost,
          financial_health_score: n.financial_health_score,
          risk_probability: n.risk_probability,
          external_risk_score: n.external_risk_score,
        },
      })),
      edges: edges.map((e) => ({
        id: e.edge_id,
        source: e.source_node,
        target: e.target_node,
        data: {
          lead_time: e.lead_time,
          dependency_percent: e.dependency_percent,
          transport_mode: e.transport_mode,
          material: e.material,
          risk_score: e.risk_score,
        },
      })),
      disruption_type,
      target_node_id,
      severity: Number(severity),
      duration_days: Number(duration_days),
      revenue_per_day: Number(revenue_per_day) || 0,
      demand_forecast_city: null, // DEFERRED
    };

    // 3. Call Python ML service
    const mlResponse = await axios.post(
      `${ANALYTICS_URL}/analytics/simulate`,
      payload,
      { timeout: 30000 }
    );

    // 4. Return results
    res.json(mlResponse.data);
  } catch (error) {
    console.error(
      "Simulation error:",
      error.response?.data || error.message
    );

    if (error.response) {
      return res.status(error.response.status).json({
        error: "ML service error",
        detail: error.response.data?.detail || error.response.data,
      });
    }

    res.status(500).json({
      error: "Simulation failed",
      detail: error.message,
    });
  }
}

/**
 * POST /api/v1/simulation/compare
 *
 * Compare two supply chain routes under a disruption scenario.
 */
async function compareRoutes(req, res) {
  const {
    route_a_node_ids,
    route_b_node_ids,
    disruption_type,
    severity = 50,
    duration_days = 7,
    workspace,
  } = req.body;

  if (!route_a_node_ids?.length || !route_b_node_ids?.length) {
    return res
      .status(400)
      .json({ error: "Both route_a_node_ids and route_b_node_ids are required." });
  }

  try {
    const filter = workspace ? { workspace } : {};
    const nodes = await Node.find(filter).lean();
    const edges = await Edge.find(filter).lean();

    const payload = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: "supplyNode",
        data: {
          name: n.name,
          type: n.type,
          country: n.country,
          region: n.region,
          risk_score: n.risk_score,
          lead_time_days: n.lead_time_days,
          cost: n.cost,
        },
      })),
      edges: edges.map((e) => ({
        id: e.edge_id,
        source: e.source_node,
        target: e.target_node,
        data: {
          lead_time: e.lead_time,
          dependency_percent: e.dependency_percent,
          transport_mode: e.transport_mode,
        },
      })),
      route_a_node_ids,
      route_b_node_ids,
      disruption_type,
      severity: Number(severity),
      duration_days: Number(duration_days),
    };

    const mlResponse = await axios.post(
      `${ANALYTICS_URL}/analytics/simulate-compare`,
      payload,
      { timeout: 30000 }
    );

    res.json(mlResponse.data);
  } catch (error) {
    console.error(
      "Route comparison error:",
      error.response?.data || error.message
    );

    if (error.response) {
      return res.status(error.response.status).json({
        error: "ML service error",
        detail: error.response.data?.detail || error.response.data,
      });
    }

    res.status(500).json({
      error: "Route comparison failed",
      detail: error.message,
    });
  }
}

module.exports = { runSimulation, compareRoutes };
