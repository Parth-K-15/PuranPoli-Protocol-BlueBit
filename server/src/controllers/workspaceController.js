const { StatusCodes } = require("http-status-codes");
const Workspace = require("../models/Workspace");
const { Node } = require("../models/Node");
const Edge = require("../models/Edge");

const listWorkspaces = async (req, res) => {
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

const togglePublish = async (req, res) => {
  const ws = await Workspace.findById(req.params.id);
  if (!ws) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  ws.published = !ws.published;
  ws.publishedAt = ws.published ? new Date() : null;
  await ws.save();

  res.status(StatusCodes.OK).json({ success: true, workspace: ws });
};

const duplicateWorkspace = async (req, res) => {
  const sourceWs = await Workspace.findById(req.params.id);
  if (!sourceWs) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  if (sourceWs.copyProtected) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ success: false, message: "This workspace is copy-protected and cannot be duplicated" });
  }

  const newWs = await Workspace.create({
    name: `Copy of ${sourceWs.name}`,
    description: sourceWs.description,
    copyProtected: true,
  });

  const sourceNodes = await Node.find({ workspace: sourceWs._id }).lean();
  const sourceEdges = await Edge.find({ workspace: sourceWs._id }).lean();

  const idMap = {};
  const ts = Date.now();
  const clonedNodes = sourceNodes.map((n) => {
    const newId = `${n.id}_copy_${ts}`;
    idMap[n.id] = newId;
    const { _id, __v, createdAt, updatedAt, ...rest } = n;
    return { ...rest, id: newId, workspace: newWs._id };
  });

  const clonedEdges = sourceEdges.map((e) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = e;
    return {
      ...rest,
      edge_id: `${e.edge_id}_copy_${ts}_${Math.random().toString(36).slice(2, 6)}`,
      workspace: newWs._id,
      source_node: idMap[e.source_node] || e.source_node,
      target_node: idMap[e.target_node] || e.target_node,
    };
  });

  if (clonedNodes.length) await Node.insertMany(clonedNodes);
  if (clonedEdges.length) await Edge.insertMany(clonedEdges);

  newWs.nodeCount = clonedNodes.length;
  newWs.edgeCount = clonedEdges.length;
  await newWs.save();

  res.status(StatusCodes.CREATED).json({ success: true, workspace: newWs });
};

const getWorkspaceNodes = async (req, res) => {
  const ws = await Workspace.findById(req.params.id).lean();
  if (!ws) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  const nodes = await Node.find({ workspace: ws._id }).lean();
  res.status(StatusCodes.OK).json({ success: true, nodes });
};

module.exports = {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  togglePublish,
  duplicateWorkspace,
  getWorkspaceNodes,
};
