const { StatusCodes } = require("http-status-codes");
const Workspace = require("../models/Workspace");
const { Node } = require("../models/Node");
const Edge = require("../models/Edge");
const {
  OFFLINE_WORKSPACE_ID,
  isMongoReady,
  mongoUnavailableMessage,
} = require("../utils/runtimeState");

const offlineWorkspace = {
  _id: OFFLINE_WORKSPACE_ID,
  name: "Offline Workspace",
  description: "MongoDB unavailable. Read-only fallback workspace.",
  nodeCount: 0,
  edgeCount: 0,
  readOnly: true,
};

const listWorkspaces = async (req, res) => {
  if (!isMongoReady()) {
    return res.status(StatusCodes.OK).json({
      success: true,
      degraded: true,
      message: mongoUnavailableMessage,
      workspaces: [offlineWorkspace],
    });
  }

  const workspaces = await Workspace.find({}).sort({ updatedAt: -1 }).lean();

  // Attach node/edge counts
  const results = await Promise.all(
    workspaces.map(async (ws) => {
      const [nodeCount, edgeCount] = await Promise.all([
        Node.countDocuments({ workspace: ws._id }),
        Edge.countDocuments({ workspace: ws._id }),
      ]);
      return { ...ws, nodeCount, edgeCount };
    })
  );

  res.status(StatusCodes.OK).json({ success: true, workspaces: results });
};

const getWorkspace = async (req, res) => {
  if (!isMongoReady()) {
    if (req.params.id === OFFLINE_WORKSPACE_ID) {
      return res.status(StatusCodes.OK).json({
        success: true,
        degraded: true,
        message: mongoUnavailableMessage,
        workspace: offlineWorkspace,
      });
    }

    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      message: mongoUnavailableMessage,
    });
  }

  const ws = await Workspace.findById(req.params.id).lean();

  if (!ws) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  const [nodeCount, edgeCount] = await Promise.all([
    Node.countDocuments({ workspace: ws._id }),
    Edge.countDocuments({ workspace: ws._id }),
  ]);

  res
    .status(StatusCodes.OK)
    .json({ success: true, workspace: { ...ws, nodeCount, edgeCount } });
};

const createWorkspace = async (req, res) => {
  if (!isMongoReady()) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      message: `${mongoUnavailableMessage} Cannot create workspace in offline mode.`,
    });
  }

  const { name, description } = req.body;

  if (!name || !name.trim()) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ success: false, message: "name is required" });
  }

  const ws = await Workspace.create({
    name: name.trim(),
    description: description?.trim() || "",
  });

  res.status(StatusCodes.CREATED).json({ success: true, workspace: ws });
};

const updateWorkspace = async (req, res) => {
  if (!isMongoReady()) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      message: `${mongoUnavailableMessage} Cannot update workspace in offline mode.`,
    });
  }

  const { name, description } = req.body;

  const ws = await Workspace.findByIdAndUpdate(
    req.params.id,
    { ...(name && { name: name.trim() }), ...(description !== undefined && { description: description.trim() }) },
    { new: true, runValidators: true }
  );

  if (!ws) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  res.status(StatusCodes.OK).json({ success: true, workspace: ws });
};

const deleteWorkspace = async (req, res) => {
  if (!isMongoReady()) {
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
      success: false,
      message: `${mongoUnavailableMessage} Cannot delete workspace in offline mode.`,
    });
  }

  const ws = await Workspace.findByIdAndDelete(req.params.id);

  if (!ws) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  // Cascade-delete all nodes & edges in this workspace
  await Promise.all([
    Node.deleteMany({ workspace: ws._id }),
    Edge.deleteMany({ workspace: ws._id }),
  ]);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: `Workspace "${ws.name}" deleted` });
};

module.exports = {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
};
