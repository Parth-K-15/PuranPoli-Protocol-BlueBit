const express = require("express");

const {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
} = require("../controllers/workspaceController");

const router = express.Router();

router.get("/", listWorkspaces);
router.get("/:id", getWorkspace);
router.post("/", createWorkspace);
router.patch("/:id", updateWorkspace);
router.delete("/:id", deleteWorkspace);

module.exports = router;
