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
} = require("../controllers/graphController");

const router = express.Router();

router.get("/graph", getGraph);
router.get("/nodes/catalog", getNodeCatalog);
router.post("/graph/demo", loadDemo);
router.post("/graph/reset", resetGraph);

router.post("/nodes", createNode);
router.patch("/nodes/:id", updateNode);
router.delete("/nodes/:id", deleteNode);

router.post("/edges", createEdge);
router.delete("/edges/:id", deleteEdge);

module.exports = router;
