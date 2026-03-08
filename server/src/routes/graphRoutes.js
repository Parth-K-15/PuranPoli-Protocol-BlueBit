const express = require("express");

const {
  getGraph,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  deleteEdge,
  loadDemo,
  resetGraph,
  getNodeCatalog,
  computeRisks,
  nodeDisruptions,
  nodeIntelligence,
} = require("../controllers/graphController");

const router = express.Router();

router.get("/graph", getGraph);
router.get("/nodes/catalog", getNodeCatalog);
router.post("/graph/demo", loadDemo);
router.post("/graph/reset", resetGraph);
router.post("/graph/compute-risks", computeRisks);

router.post("/nodes", createNode);
router.patch("/nodes/:id", updateNode);
router.delete("/nodes/:id", deleteNode);
router.get("/nodes/:id/disruptions", nodeDisruptions);
router.get("/nodes/:id/intelligence", nodeIntelligence);

router.post("/edges", createEdge);
router.delete("/edges/:id", deleteEdge);

module.exports = router;
