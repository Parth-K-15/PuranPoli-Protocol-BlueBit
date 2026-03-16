const express = require("express");
const { runSimulation, compareRoutes } = require("../controllers/simulationController");

const router = express.Router();

// POST /api/v1/simulation/run
router.post("/run", runSimulation);

// POST /api/v1/simulation/compare
router.post("/compare", compareRoutes);

module.exports = router;
