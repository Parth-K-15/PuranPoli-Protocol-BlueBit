const express = require("express");

const {
  getGraph,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  deleteEdge,
  loadDemo,
} = require("../controllers/graphController");

const router = express.Router();

router.get("/graph", getGraph);
router.post("/graph/demo", loadDemo);

router.post("/nodes", createNode);
router.patch("/nodes/:id", updateNode);
router.delete("/nodes/:id", deleteNode);

router.post("/edges", createEdge);
router.delete("/edges/:id", deleteEdge);

module.exports = router;
