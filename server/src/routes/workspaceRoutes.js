const express = require("express");

const {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  togglePublish,
  duplicateWorkspace,
  getWorkspaceNodes,
} = require("../controllers/workspaceController");

const router = express.Router();

router.get("/", listWorkspaces);
router.post("/", createWorkspace);
router.patch("/:id/publish", togglePublish);
router.post("/:id/duplicate", duplicateWorkspace);
router.get("/:id/nodes", getWorkspaceNodes);
router.get("/:id", getWorkspace);
router.patch("/:id", updateWorkspace);
router.delete("/:id", deleteWorkspace);

module.exports = router;
