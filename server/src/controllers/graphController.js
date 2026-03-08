const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");

const { Node, NODE_TYPES } = require("../models/Node");
const Edge = require("../models/Edge");
const Workspace = require("../models/Workspace");
const { demoNodes, demoEdges } = require("../data/demoGraph");
const { nodeCatalog } = require("../data/nodeCatalog");
const { CatalogItem } = require("../models/CatalogItem");
const { computeAllNodeRisks, getDisruptionsForNode, getNodeIntelligence } = require("../services/riskEngine");

const toReactFlowNode = (nodeDoc) => ({
  id: nodeDoc.id,
  position: nodeDoc.position || { x: 0, y: 0 },
  data: {
    id: nodeDoc.id,
    name: nodeDoc.name,
    type: nodeDoc.type,
    country: nodeDoc.country,
    region: nodeDoc.region,
    capacity: nodeDoc.capacity,
    inventory: nodeDoc.inventory,
    risk_score: nodeDoc.risk_score,
    lead_time_days: nodeDoc.lead_time_days,
    reliability_score: nodeDoc.reliability_score,
    dependency_percentage: nodeDoc.dependency_percentage,
    compliance_status: nodeDoc.compliance_status,
    gmp_status: nodeDoc.gmp_status,
    fda_approval: nodeDoc.fda_approval,
    cold_chain_capable: nodeDoc.cold_chain_capable,
    cost: nodeDoc.cost,
    moq: nodeDoc.moq,
    contract_duration_months: nodeDoc.contract_duration_months,
    batch_cycle_time_days: nodeDoc.batch_cycle_time_days,
    financial_health_score: nodeDoc.financial_health_score,
    risk_probability: nodeDoc.risk_probability || "Low",
    external_risk_score: nodeDoc.external_risk_score || 0,
    last_risk_update: nodeDoc.last_risk_update,
  },
  type: "supplyNode",
});

const toReactFlowEdge = (edgeDoc) => ({
  id: edgeDoc.edge_id,
  source: edgeDoc.source_node,
  target: edgeDoc.target_node,
  data: {
    material: edgeDoc.material,
    lead_time: edgeDoc.lead_time,
    dependency_percent: edgeDoc.dependency_percent,
    transport_mode: edgeDoc.transport_mode,
    risk_score: edgeDoc.risk_score,
  },
  animated: false,
  markerEnd: { type: "arrowclosed" },
});

// Helper: resolve workspace from query param ?workspace=<id>
const resolveWorkspace = (req) => {
  const wsId = req.query.workspace;
  if (!wsId || !mongoose.Types.ObjectId.isValid(wsId)) return null;
  return wsId;
};

const syncWorkspaceCounts = async (workspaceId) => {
  if (!workspaceId || !mongoose.Types.ObjectId.isValid(workspaceId)) {
    return;
  }

  const [nodeCount, edgeCount] = await Promise.all([
    Node.countDocuments({ workspace: workspaceId }),
    Edge.countDocuments({ workspace: workspaceId }),
  ]);

  await Workspace.findByIdAndUpdate(workspaceId, { nodeCount, edgeCount });
};

const getGraph = async (req, res) => {
  const wsId = resolveWorkspace(req);
  const filter = wsId ? { workspace: wsId } : {};

  const [nodes, edges] = await Promise.all([
    Node.find(filter).lean(),
    Edge.find(filter).lean(),
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    nodes: nodes.map(toReactFlowNode),
    edges: edges.map(toReactFlowEdge),
  });
};

const createNode = async (req, res) => {
  const {
    id,
    name,
    type,
    country,
    region,
    capacity,
    inventory,
    risk_score,
    lead_time_days,
    reliability_score,
    dependency_percentage,
    compliance_status,
    gmp_status,
    fda_approval,
    cold_chain_capable,
    cost,
    moq,
    contract_duration_months,
    batch_cycle_time_days,
    financial_health_score,
    position,
    workspace,
  } = req.body;

  if (!id || !name || !type) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "id, name and type are required",
    });
  }

  if (!NODE_TYPES.includes(type)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: `Invalid type. Allowed: ${NODE_TYPES.join(", ")}`,
    });
  }

  if (!workspace || !mongoose.Types.ObjectId.isValid(workspace)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "A valid workspace id is required",
    });
  }

  const node = await Node.create({
    id,
    workspace,
    name,
    type,
    country,
    region,
    capacity,
    inventory,
    risk_score,
    lead_time_days,
    reliability_score,
    dependency_percentage,
    compliance_status,
    gmp_status,
    fda_approval,
    cold_chain_capable,
    cost,
    moq,
    contract_duration_months,
    batch_cycle_time_days,
    financial_health_score,
    position,
  });

  await syncWorkspaceCounts(workspace);

  res.status(StatusCodes.CREATED).json({
    success: true,
    node: toReactFlowNode(node),
  });
};

const updateNode = async (req, res) => {
  const { id } = req.params;
  const payload = { ...req.body };
  // Prevent changing workspace via update
  delete payload.workspace;

  if (payload.type && !NODE_TYPES.includes(payload.type)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: `Invalid type. Allowed: ${NODE_TYPES.join(", ")}`,
    });
  }

  const node = await Node.findOneAndUpdate({ id }, payload, {
    new: true,
    runValidators: true,
  });

  if (!node) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `Node ${id} not found`,
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    node: toReactFlowNode(node),
  });
};

const deleteNode = async (req, res) => {
  const { id } = req.params;

  const node = await Node.findOneAndDelete({ id });

  if (!node) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `Node ${id} not found`,
    });
  }

  await Edge.deleteMany({
    workspace: node.workspace,
    $or: [{ source_node: id }, { target_node: id }],
  });

  await syncWorkspaceCounts(node.workspace);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Node ${id} and connected edges deleted`,
  });
};

const createEdge = async (req, res) => {
  const {
    edge_id,
    source_node,
    target_node,
    material,
    lead_time,
    dependency_percent,
    transport_mode,
    risk_score,
    workspace,
  } = req.body;

  if (!edge_id || !source_node || !target_node) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "edge_id, source_node and target_node are required",
    });
  }

  if (!workspace || !mongoose.Types.ObjectId.isValid(workspace)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "A valid workspace id is required",
    });
  }

  const [sourceExists, targetExists] = await Promise.all([
    Node.exists({ id: source_node, workspace }),
    Node.exists({ id: target_node, workspace }),
  ]);

  if (!sourceExists || !targetExists) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Source or target node does not exist in this workspace",
    });
  }

  const edge = await Edge.create({
    edge_id,
    workspace,
    source_node,
    target_node,
    material,
    lead_time,
    dependency_percent,
    transport_mode,
    risk_score,
  });

  await syncWorkspaceCounts(workspace);

  res.status(StatusCodes.CREATED).json({
    success: true,
    edge: toReactFlowEdge(edge),
  });
};

const deleteEdge = async (req, res) => {
  const { id } = req.params;

  const edge = await Edge.findOneAndDelete({ edge_id: id });

  if (!edge) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `Edge ${id} not found`,
    });
  }

  await syncWorkspaceCounts(edge.workspace);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Edge ${id} deleted`,
  });
};

const loadDemo = async (req, res) => {
  const wsId = resolveWorkspace(req);

  // If workspace provided, clear only that workspace; else create a "Demo" workspace
  let targetWs;
  if (wsId) {
    targetWs = wsId;
    await Promise.all([
      Node.deleteMany({ workspace: wsId }),
      Edge.deleteMany({ workspace: wsId }),
    ]);
  } else {
    const ws = await Workspace.create({ name: "Demo Workspace" });
    targetWs = ws._id;
  }

  const taggedNodes = demoNodes.map((n) => ({ ...n, workspace: targetWs }));
  const taggedEdges = demoEdges.map((e) => ({ ...e, workspace: targetWs }));

  await Node.insertMany(taggedNodes);
  await Edge.insertMany(taggedEdges);
  await syncWorkspaceCounts(targetWs);

  const [nodes, edges] = await Promise.all([
    Node.find({ workspace: targetWs }).lean(),
    Edge.find({ workspace: targetWs }).lean(),
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Demo graph loaded",
    workspace: targetWs,
    nodes: nodes.map(toReactFlowNode),
    edges: edges.map(toReactFlowEdge),
  });
};

const resetGraph = async (req, res) => {
  const wsId = resolveWorkspace(req);
  const filter = wsId ? { workspace: wsId } : {};

  await Promise.all([Node.deleteMany(filter), Edge.deleteMany(filter)]);

  if (wsId) {
    await syncWorkspaceCounts(wsId);
  }

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Workspace reset to empty graph",
    nodes: [],
    edges: [],
  });
};

const getNodeCatalog = async (req, res) => {
  const { type } = req.query;
  const filter = {};
  if (type) filter.type = type;

  // Try DB first
  const dbItems = await CatalogItem.find(filter).sort({ type: 1, name: 1 }).lean();

  if (dbItems.length > 0) {
    const catalog = {};
    for (const item of dbItems) {
      if (!catalog[item.type]) catalog[item.type] = [];
      catalog[item.type].push(item);
    }
    return res.status(StatusCodes.OK).json({ success: true, catalog });
  }

  // Fall back to static data
  if (type && nodeCatalog[type]) {
    return res.status(StatusCodes.OK).json({ success: true, catalog: { [type]: nodeCatalog[type] } });
  }
  res.status(StatusCodes.OK).json({ success: true, catalog: nodeCatalog });
};

// ── Risk computation ──────────────────────────────────────────────────────────
const computeRisks = async (req, res) => {
  const wsId = resolveWorkspace(req);
  const filter = wsId ? { workspace: wsId } : {};
  const results = await computeAllNodeRisks(filter);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Risk scores updated for ${results.length} nodes`,
    count: results.length,
    nodes: results,
  });
};

const nodeDisruptions = async (req, res) => {
  const { id } = req.params;
  const { node, disruptions } = await getDisruptionsForNode(id);

  if (!node) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `Node ${id} not found`,
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    node,
    disruptions,
  });
};

const nodeIntelligence = async (req, res) => {
  const { id } = req.params;
  const intel = await getNodeIntelligence(id);

  if (!intel) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `Node ${id} not found`,
    });
  }

  res.status(StatusCodes.OK).json({ success: true, ...intel });
};

module.exports = {
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
};
