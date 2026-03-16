const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");
const Workspace = require("../models/Workspace");
const { Node } = require("../models/Node");
const Edge = require("../models/Edge");
const { computeAllNodeRisks } = require("../services/riskEngine");

// ── Existing CRUD ───────────────────────────────────────────────────────────

const listWorkspaces = async (req, res) => {
  const workspaces = await Workspace.find({}).sort({ updatedAt: -1 }).lean();

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
    owner: req.user?.id || null,
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

  await Promise.all([
    Node.deleteMany({ workspace: ws._id }),
    Edge.deleteMany({ workspace: ws._id }),
  ]);

  res
    .status(StatusCodes.OK)
    .json({ success: true, message: `Workspace "${ws.name}" deleted` });
};

// ── Supplier: list my workspaces ────────────────────────────────────────────

const listMyWorkspaces = async (req, res) => {
  const workspaces = await Workspace.find({ owner: req.user.id })
    .sort({ updatedAt: -1 })
    .lean();

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

// ── Publishing ──────────────────────────────────────────────────────────────

const publishWorkspace = async (req, res) => {
  const { publisherName, tags, description } = req.body;

  const ws = await Workspace.findById(req.params.id);
  if (!ws) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  if (ws.owner && ws.owner.toString() !== req.user.id) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ success: false, message: "Not authorized to publish this workspace" });
  }

  ws.isPublished = true;
  if (typeof publisherName === "string") {
    ws.publisherName = publisherName.trim();
  }
  if (typeof description === "string") {
    ws.description = description.trim();
  }
  ws.publishedAt = new Date();
  if (Array.isArray(tags)) {
    ws.tags = [...new Set(tags.map((tag) => String(tag).trim()).filter(Boolean))];
  }
  await ws.save();

  res.status(StatusCodes.OK).json({ success: true, workspace: ws });
};

const unpublishWorkspace = async (req, res) => {
  const ws = await Workspace.findById(req.params.id);
  if (!ws) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Workspace not found" });
  }

  if (ws.owner && ws.owner.toString() !== req.user.id) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ success: false, message: "Not authorized" });
  }

  ws.isPublished = false;
  ws.publishedAt = null;
  await ws.save();

  res.status(StatusCodes.OK).json({ success: true, workspace: ws });
};

// ── Import ──────────────────────────────────────────────────────────────────

const syncWorkspaceCounts = async (workspaceId) => {
  if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) return;
  const [nodeCount, edgeCount] = await Promise.all([
    Node.countDocuments({ workspace: workspaceId }),
    Edge.countDocuments({ workspace: workspaceId }),
  ]);
  await Workspace.findByIdAndUpdate(workspaceId, { nodeCount, edgeCount });
};

const selectSupplierEntryNode = (sourceNodes = []) => {
  const preferredTypes = [
    "Manufacturer",
    "Tier1Supplier",
    "Tier2Supplier",
    "Tier3Supplier",
    "RawMaterialSource",
  ];

  for (const type of preferredTypes) {
    const matched = sourceNodes.find((node) => node.type === type);
    if (matched) return matched;
  }

  return sourceNodes[0] || null;
};

const findSupplierBridgeEdge = async ({ targetWsId, anchorNodeId, sourceWorkspaceId }) => {
  const outgoingEdges = await Edge.find({
    workspace: targetWsId,
    source_node: anchorNodeId,
  }).lean();

  if (outgoingEdges.length === 0) return null;

  const candidateTargetIds = [...new Set(outgoingEdges.map((edge) => edge.target_node))];
  const importedTargets = await Node.find({
    workspace: targetWsId,
    id: { $in: candidateTargetIds },
    imported: true,
    sourceWorkspace: sourceWorkspaceId,
  })
    .select("id")
    .lean();

  const importedTargetSet = new Set(importedTargets.map((node) => node.id));
  return outgoingEdges.find((edge) => importedTargetSet.has(edge.target_node)) || null;
};

const viewSupplierNetwork = async (req, res) => {
  const targetWsId = req.params.id;
  const { anchorNodeId, sourceWorkspaceId } = req.body;

  if (!anchorNodeId || !sourceWorkspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "anchorNodeId and sourceWorkspaceId are required",
    });
  }

  if (
    !mongoose.Types.ObjectId.isValid(targetWsId) ||
    !mongoose.Types.ObjectId.isValid(sourceWorkspaceId)
  ) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Invalid workspace id",
    });
  }

  const [targetWs, sourceWs, anchorNode] = await Promise.all([
    Workspace.findById(targetWsId),
    Workspace.findById(sourceWorkspaceId),
    Node.findOne({ workspace: targetWsId, id: anchorNodeId }),
  ]);

  if (!targetWs) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Target workspace not found" });
  }

  if (!sourceWs || !sourceWs.isPublished) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: "Source workspace not found or not published",
    });
  }

  if (!anchorNode) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Anchor node not found in target workspace",
    });
  }

  const existingBridge = await findSupplierBridgeEdge({
    targetWsId,
    anchorNodeId,
    sourceWorkspaceId,
  });

  if (existingBridge) {
    return res.status(StatusCodes.OK).json({
      success: true,
      alreadyExpanded: true,
      bridgeEdgeId: existingBridge.edge_id,
      message: "Supplier network is already expanded for this node",
    });
  }

  const [sourceNodes, sourceEdges] = await Promise.all([
    Node.find({ workspace: sourceWorkspaceId }).lean(),
    Edge.find({ workspace: sourceWorkspaceId }).lean(),
  ]);

  if (sourceNodes.length === 0) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Source workspace has no nodes",
    });
  }

  const entryNode = selectSupplierEntryNode(sourceNodes);
  if (!entryNode) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Could not determine source entry node",
    });
  }

  const shortSrc = sourceWorkspaceId.toString().slice(-6);
  const ts = Date.now();
  const idMap = {};

  sourceNodes.forEach((sourceNode, index) => {
    idMap[sourceNode.id] = `sup_${shortSrc}_${ts}_${index}_${Math.floor(Math.random() * 1000)}`;
  });

  const anchorPos = anchorNode.position || { x: 0, y: 0 };
  const entryPos = entryNode.position || { x: 0, y: 0 };
  const offsetX = anchorPos.x + 280 - entryPos.x;
  const offsetY = anchorPos.y - entryPos.y;

  const clonedNodes = sourceNodes.map((sourceNode) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = sourceNode;
    return {
      ...rest,
      id: idMap[sourceNode.id],
      workspace: targetWsId,
      position: {
        x: (sourceNode.position?.x || 0) + offsetX,
        y: (sourceNode.position?.y || 0) + offsetY,
      },
      imported: true,
      sourceWorkspace: sourceWorkspaceId,
      originalNodeId: sourceNode.originalNodeId || sourceNode.id,
    };
  });

  const clonedEdges = sourceEdges.reduce((acc, sourceEdge, index) => {
    const mappedSource = idMap[sourceEdge.source_node];
    const mappedTarget = idMap[sourceEdge.target_node];
    if (!mappedSource || !mappedTarget) return acc;

    const { _id, __v, createdAt, updatedAt, ...rest } = sourceEdge;
    acc.push({
      ...rest,
      edge_id: `sup_edge_${shortSrc}_${ts}_${index}_${Math.floor(Math.random() * 1000)}`,
      workspace: targetWsId,
      source_node: mappedSource,
      target_node: mappedTarget,
      imported: true,
      originalEdgeId: sourceEdge.originalEdgeId || sourceEdge.edge_id,
    });
    return acc;
  }, []);

  const bridgeEdge = {
    edge_id: `sup_bridge_${shortSrc}_${ts}_${Math.floor(Math.random() * 1000)}`,
    workspace: targetWsId,
    source_node: anchorNodeId,
    target_node: idMap[entryNode.id],
    material: "Supplier network link",
    lead_time: 0,
    dependency_percent: 50,
    transport_mode: "",
    risk_score: 0,
    imported: false,
  };

  await Node.insertMany(clonedNodes, { ordered: false });
  await Edge.insertMany([...clonedEdges, bridgeEdge], { ordered: false });

  const importedNodeIds = clonedNodes.map((node) => node.id);
  let riskResults = [];
  if (importedNodeIds.length > 0) {
    try {
      riskResults = await computeAllNodeRisks({
        workspace: targetWsId,
        id: { $in: importedNodeIds },
      });
    } catch {
      riskResults = [];
    }
  }

  await Promise.all([
    Workspace.findByIdAndUpdate(sourceWorkspaceId, { $inc: { importCount: 1 } }),
    syncWorkspaceCounts(targetWsId),
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    expanded: true,
    alreadyExpanded: false,
    importedNodeCount: clonedNodes.length,
    importedEdgeCount: clonedEdges.length + 1,
    riskUpdatedNodeCount: riskResults.length,
    bridgeEdgeId: bridgeEdge.edge_id,
  });
};

const collapseSupplierNetwork = async (req, res) => {
  const targetWsId = req.params.id;
  const { anchorNodeId, sourceWorkspaceId } = req.body;

  if (!anchorNodeId || !sourceWorkspaceId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "anchorNodeId and sourceWorkspaceId are required",
    });
  }

  if (
    !mongoose.Types.ObjectId.isValid(targetWsId) ||
    !mongoose.Types.ObjectId.isValid(sourceWorkspaceId)
  ) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Invalid workspace id",
    });
  }

  const targetWs = await Workspace.findById(targetWsId);
  if (!targetWs) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Target workspace not found" });
  }

  const bridgeEdge = await findSupplierBridgeEdge({
    targetWsId,
    anchorNodeId,
    sourceWorkspaceId,
  });

  if (!bridgeEdge) {
    return res.status(StatusCodes.OK).json({
      success: true,
      collapsed: false,
      message: "No expanded supplier network found for this node",
    });
  }

  const importedNodes = await Node.find({
    workspace: targetWsId,
    imported: true,
    sourceWorkspace: sourceWorkspaceId,
  })
    .select("id")
    .lean();

  const importedNodeIds = importedNodes.map((node) => node.id);
  const importedNodeSet = new Set(importedNodeIds);

  if (!importedNodeSet.has(bridgeEdge.target_node)) {
    await Edge.deleteOne({ _id: bridgeEdge._id });
    await syncWorkspaceCounts(targetWsId);
    return res.status(StatusCodes.OK).json({
      success: true,
      collapsed: true,
      removedNodeCount: 0,
      removedEdgeCount: 1,
      message: "Removed stale bridge edge",
    });
  }

  const importedEdges = await Edge.find({
    workspace: targetWsId,
    imported: true,
    $or: [
      { source_node: { $in: importedNodeIds } },
      { target_node: { $in: importedNodeIds } },
    ],
  }).lean();

  const adjacency = new Map();
  const validImportedEdges = [];
  for (const edge of importedEdges) {
    if (!importedNodeSet.has(edge.source_node) || !importedNodeSet.has(edge.target_node)) {
      continue;
    }
    validImportedEdges.push(edge);
    if (!adjacency.has(edge.source_node)) adjacency.set(edge.source_node, []);
    if (!adjacency.has(edge.target_node)) adjacency.set(edge.target_node, []);
    adjacency.get(edge.source_node).push(edge.target_node);
    adjacency.get(edge.target_node).push(edge.source_node);
  }

  const componentNodes = new Set([bridgeEdge.target_node]);
  const queue = [bridgeEdge.target_node];

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (componentNodes.has(neighbor)) continue;
      componentNodes.add(neighbor);
      queue.push(neighbor);
    }
  }

  const importedEdgeIdsToDelete = validImportedEdges
    .filter(
      (edge) => componentNodes.has(edge.source_node) && componentNodes.has(edge.target_node)
    )
    .map((edge) => edge._id);

  await Edge.deleteMany({ _id: { $in: [...importedEdgeIdsToDelete, bridgeEdge._id] } });
  await Node.deleteMany({
    workspace: targetWsId,
    imported: true,
    sourceWorkspace: sourceWorkspaceId,
    id: { $in: [...componentNodes] },
  });

  await syncWorkspaceCounts(targetWsId);

  res.status(StatusCodes.OK).json({
    success: true,
    collapsed: true,
    removedNodeCount: componentNodes.size,
    removedEdgeCount: importedEdgeIdsToDelete.length + 1,
  });
};

const importChain = async (req, res) => {
  const targetWsId = req.params.id;
  const { sourceWorkspaceId, anchorNodeId, entryNodeId } = req.body;

  if (!sourceWorkspaceId || !anchorNodeId || !entryNodeId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ success: false, message: "sourceWorkspaceId, anchorNodeId, and entryNodeId are required" });
  }

  const [targetWs, sourceWs] = await Promise.all([
    Workspace.findById(targetWsId),
    Workspace.findById(sourceWorkspaceId),
  ]);

  if (!targetWs) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Target workspace not found" });
  }
  if (!sourceWs || !sourceWs.isPublished) {
    return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Source workspace not found or not published" });
  }

  const [anchorNode, entryNode] = await Promise.all([
    Node.findOne({ id: anchorNodeId, workspace: targetWsId }),
    Node.findOne({ id: entryNodeId, workspace: sourceWorkspaceId }),
  ]);

  if (!anchorNode) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Anchor node not found in target workspace" });
  }
  if (!entryNode) {
    return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Entry node not found in source workspace" });
  }

  const [sourceNodes, sourceEdges] = await Promise.all([
    Node.find({ workspace: sourceWorkspaceId }).lean(),
    Edge.find({ workspace: sourceWorkspaceId }).lean(),
  ]);

  // Generate ID mapping
  const shortSrc = sourceWorkspaceId.toString().slice(-6);
  const ts = Date.now();
  const idMap = {};
  for (const sn of sourceNodes) {
    idMap[sn.id] = `imp_${shortSrc}_${sn.id}_${ts}`;
  }

  // Calculate position offset
  const existingNodes = await Node.find({ workspace: targetWsId }).lean();
  let offsetX = 400;
  let offsetY = 0;
  if (existingNodes.length > 0 && sourceNodes.length > 0) {
    const maxX = Math.max(...existingNodes.map((n) => n.position?.x || 0));
    const existingCenterY =
      existingNodes.reduce((sum, n) => sum + (n.position?.y || 0), 0) / existingNodes.length;
    const sourceCenterY =
      sourceNodes.reduce((sum, n) => sum + (n.position?.y || 0), 0) / sourceNodes.length;
    const sourceMinX = Math.min(...sourceNodes.map((n) => n.position?.x || 0));
    offsetX = maxX + 400 - sourceMinX;
    offsetY = existingCenterY - sourceCenterY;
  }

  // Clone nodes
  const clonedNodes = sourceNodes.map((sn) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = sn;
    return {
      ...rest,
      id: idMap[sn.id],
      workspace: targetWsId,
      position: {
        x: (sn.position?.x || 0) + offsetX,
        y: (sn.position?.y || 0) + offsetY,
      },
      imported: true,
      sourceWorkspace: sourceWorkspaceId,
      originalNodeId: sn.id,
    };
  });

  // Clone edges
  const clonedEdges = sourceEdges.map((se) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = se;
    return {
      ...rest,
      edge_id: `imp_edge_${shortSrc}_${se.edge_id}_${ts}`,
      workspace: targetWsId,
      source_node: idMap[se.source_node],
      target_node: idMap[se.target_node],
      imported: true,
      originalEdgeId: se.edge_id,
    };
  });

  // Bridge edge connecting anchor → imported entry
  const bridgeEdge = {
    edge_id: `bridge_${ts}_${Math.floor(Math.random() * 10000)}`,
    workspace: targetWsId,
    source_node: anchorNodeId,
    target_node: idMap[entryNodeId],
    material: "Imported supply link",
    lead_time: 0,
    dependency_percent: 50,
    transport_mode: "",
    risk_score: 0,
    imported: false,
  };

  await Node.insertMany(clonedNodes, { ordered: false });
  await Edge.insertMany([...clonedEdges, bridgeEdge], { ordered: false });

  await Promise.all([
    Workspace.findByIdAndUpdate(sourceWorkspaceId, { $inc: { importCount: 1 } }),
    syncWorkspaceCounts(targetWsId),
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    importedNodeCount: clonedNodes.length,
    importedEdgeCount: clonedEdges.length + 1,
    bridgeEdgeId: bridgeEdge.edge_id,
  });
};

const pasteNetwork = async (req, res) => {
  const targetWsId = req.params.id;
  const { sourceWorkspaceId } = req.body;

  if (!sourceWorkspaceId) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ success: false, message: "sourceWorkspaceId is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(targetWsId) || !mongoose.Types.ObjectId.isValid(sourceWorkspaceId)) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ success: false, message: "Invalid workspace id" });
  }

  const [targetWs, sourceWs] = await Promise.all([
    Workspace.findById(targetWsId),
    Workspace.findById(sourceWorkspaceId),
  ]);

  if (!targetWs) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Target workspace not found" });
  }

  if (!sourceWs) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Source workspace not found" });
  }

  if (targetWs.owner && targetWs.owner.toString() !== req.user.id) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ success: false, message: "Not authorized to paste into target workspace" });
  }

  const canReadSource =
    !sourceWs.owner ||
    sourceWs.owner.toString() === req.user.id ||
    sourceWs.isPublished;

  if (!canReadSource) {
    return res
      .status(StatusCodes.FORBIDDEN)
      .json({ success: false, message: "Not authorized to copy this source workspace" });
  }

  const [sourceNodes, sourceEdges, existingTargetNodes] = await Promise.all([
    Node.find({ workspace: sourceWorkspaceId }).lean(),
    Edge.find({ workspace: sourceWorkspaceId }).lean(),
    Node.find({ workspace: targetWsId }).lean(),
  ]);

  if (sourceNodes.length === 0) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ success: false, message: "Source workspace has no nodes to copy" });
  }

  const shortSrc = sourceWorkspaceId.toString().slice(-6);
  const ts = Date.now();

  const idMap = {};
  sourceNodes.forEach((sourceNode, index) => {
    idMap[sourceNode.id] = `cpy_${shortSrc}_${ts}_${index}_${Math.floor(Math.random() * 1000)}`;
  });

  let offsetX = 240;
  let offsetY = 0;
  if (existingTargetNodes.length > 0 && sourceNodes.length > 0) {
    const maxX = Math.max(...existingTargetNodes.map((node) => node.position?.x || 0));
    const targetCenterY =
      existingTargetNodes.reduce((sum, node) => sum + (node.position?.y || 0), 0) /
      existingTargetNodes.length;
    const sourceCenterY =
      sourceNodes.reduce((sum, node) => sum + (node.position?.y || 0), 0) /
      sourceNodes.length;
    const sourceMinX = Math.min(...sourceNodes.map((node) => node.position?.x || 0));

    offsetX = maxX + 240 - sourceMinX;
    offsetY = targetCenterY - sourceCenterY;
  }

  const clonedNodes = sourceNodes.map((sourceNode) => {
    const { _id, __v, createdAt, updatedAt, ...rest } = sourceNode;
    return {
      ...rest,
      id: idMap[sourceNode.id],
      workspace: targetWsId,
      position: {
        x: (sourceNode.position?.x || 0) + offsetX,
        y: (sourceNode.position?.y || 0) + offsetY,
      },
      imported: true,
      sourceWorkspace: sourceWorkspaceId,
      originalNodeId: sourceNode.originalNodeId || sourceNode.id,
    };
  });

  const clonedEdges = sourceEdges.reduce((acc, sourceEdge, index) => {
    const mappedSource = idMap[sourceEdge.source_node];
    const mappedTarget = idMap[sourceEdge.target_node];
    if (!mappedSource || !mappedTarget) {
      return acc;
    }

    const { _id, __v, createdAt, updatedAt, ...rest } = sourceEdge;
    acc.push({
      ...rest,
      edge_id: `cpy_edge_${shortSrc}_${ts}_${index}_${Math.floor(Math.random() * 1000)}`,
      workspace: targetWsId,
      source_node: mappedSource,
      target_node: mappedTarget,
      imported: true,
      originalEdgeId: sourceEdge.originalEdgeId || sourceEdge.edge_id,
    });

    return acc;
  }, []);

  await Node.insertMany(clonedNodes, { ordered: false });
  if (clonedEdges.length > 0) {
    await Edge.insertMany(clonedEdges, { ordered: false });
  }

  await syncWorkspaceCounts(targetWsId);

  res.status(StatusCodes.OK).json({
    success: true,
    copiedNodeCount: clonedNodes.length,
    copiedEdgeCount: clonedEdges.length,
    sourceWorkspaceId,
    targetWorkspaceId: targetWsId,
  });
};

module.exports = {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  listMyWorkspaces,
  publishWorkspace,
  unpublishWorkspace,
  importChain,
  pasteNetwork,
  viewSupplierNetwork,
  collapseSupplierNetwork,
};
