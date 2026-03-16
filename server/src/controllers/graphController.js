const { StatusCodes } = require("http-status-codes");
const mongoose = require("mongoose");

const { Node, NODE_TYPES } = require("../models/Node");
const Edge = require("../models/Edge");
const Workspace = require("../models/Workspace");
const { demoNodes, demoEdges } = require("../data/demoGraph");
const { nodeCatalog } = require("../data/nodeCatalog");
const { getPharmaCatalogAndSchema } = require("../data/pharmaCatalog");
const { CatalogItem } = require("../models/CatalogItem");
const Supplier = require("../models/Supplier");
const User = require("../models/User");
const { computeAllNodeRisks, getDisruptionsForNode, getNodeIntelligence } = require("../services/riskEngine");

const SUPPLIER_TIER_TYPE_MAP = {
  1: "Tier1Supplier",
  2: "Tier2Supplier",
  3: "Tier3Supplier",
};

const normalizeLookupKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

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
    imported: nodeDoc.imported || false,
    sourceWorkspace: nodeDoc.sourceWorkspace || null,
    originalNodeId: nodeDoc.originalNodeId || null,
    linkedWorkspace: nodeDoc.linkedWorkspace || null,
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

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const toCatalogItemFromSupplier = (
  supplierDoc,
  typeOverride = null,
  linkedWorkspace = null
) => {
  const type = typeOverride || SUPPLIER_TIER_TYPE_MAP[supplierDoc.tier];
  const capacity = Math.max(0, Math.round(Number(supplierDoc.production_capacity) || 0));
  const utilization = clampPercent(supplierDoc.capacity_utilization_pct);
  const inventory = Math.max(0, Math.round(capacity * (1 - utilization / 100)));
  const delayPercent = clampPercent(supplierDoc.historical_delay_frequency_pct);

  return {
    catalogId: `supplier_${supplierDoc._id}${typeOverride ? `_${typeOverride}` : ""}`,
    type,
    name:
      supplierDoc.name ||
      `${supplierDoc.supplier_id || "SUP"} - ${supplierDoc.country || "Unknown"}`,
    country: supplierDoc.country || "",
    region: supplierDoc.region || "",
    capacity,
    inventory,
    risk_score: clampPercent(supplierDoc.composite_risk_score),
    lead_time_days: Math.max(0, Math.round(Number(supplierDoc.avg_lead_time_days) || 0)),
    reliability_score: clampPercent(100 - delayPercent),
    dependency_percentage: clampPercent(supplierDoc.dependency_pct),
    compliance_status: supplierDoc.compliance_violation_flag ? "Watchlist" : "Compliant",
    gmp_status: supplierDoc.gmp_status ? "Certified" : "Pending",
    fda_approval: supplierDoc.fda_approved ? "Approved" : "Pending",
    cold_chain_capable: Boolean(supplierDoc.cold_chain_capable),
    cost: 0,
    moq: 0,
    contract_duration_months: Math.max(
      0,
      Math.round(Number(supplierDoc.contract_duration_months) || 0)
    ),
    batch_cycle_time_days: Math.max(
      0,
      Math.round(Number(supplierDoc.batch_cycle_time_days) || 0)
    ),
    financial_health_score: clampPercent(supplierDoc.financial_health_score),
    linkedWorkspace,
  };
};

const toCatalogItemFromUser = (userDoc, linkedWorkspace = null) => ({
  catalogId: `user_${userDoc._id}`,
  type: "Tier1Supplier",
  name: userDoc.companyName || userDoc.name || userDoc.email || "Supplier",
  country: "",
  region: "",
  capacity: 0,
  inventory: 0,
  risk_score: 0,
  lead_time_days: 0,
  reliability_score: 0,
  dependency_percentage: 0,
  compliance_status: "Unknown",
  gmp_status: "Unknown",
  fda_approval: "Unknown",
  cold_chain_capable: false,
  cost: 0,
  moq: 0,
  contract_duration_months: 0,
  batch_cycle_time_days: 0,
  financial_health_score: 0,
  linkedWorkspace,
});

const dedupeCatalogItems = (items = []) => {
  const seen = new Set();
  const deduped = [];

  for (const item of items) {
    const key = item?.catalogId || `${item?.type}_${item?.name}_${item?.country || ""}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
};

const loadSupplierCatalog = async () => {
  const [suppliers, supplierUsers, publishedWorkspaces] = await Promise.all([
    Supplier.find({}).sort({ updatedAt: -1 }).lean(),
    User.find({ role: "supplier", companyName: { $exists: true, $ne: "" } })
      .sort({ updatedAt: -1 })
      .select("companyName name email role")
      .lean(),
    Workspace.find({ isPublished: true })
      .sort({ publishedAt: -1, updatedAt: -1 })
      .select("_id name publisherName")
      .lean(),
  ]);

  const publishedWorkspaceByKey = new Map();
  for (const workspace of publishedWorkspaces) {
    const candidateKeys = [workspace.publisherName, workspace.name]
      .map((value) => normalizeLookupKey(value))
      .filter(Boolean);

    for (const key of candidateKeys) {
      if (!publishedWorkspaceByKey.has(key)) {
        publishedWorkspaceByKey.set(key, workspace._id.toString());
      }
    }
  }

  const byType = {
    RawMaterialSource: [],
    Tier1Supplier: [],
    Tier2Supplier: [],
    Tier3Supplier: [],
  };

  for (const supplier of suppliers) {
    const supplierKey = normalizeLookupKey(supplier.name || supplier.supplier_id);
    const linkedWorkspace = supplierKey
      ? publishedWorkspaceByKey.get(supplierKey) || null
      : null;

    const isUserCreated = supplier.imported_from_csv !== true;
    if (isUserCreated) {
      byType.Tier1Supplier.push(
        toCatalogItemFromSupplier(supplier, "Tier1Supplier", linkedWorkspace)
      );
      continue;
    }

    const mappedType = SUPPLIER_TIER_TYPE_MAP[supplier.tier];
    if (!mappedType) continue;

    byType[mappedType].push(
      toCatalogItemFromSupplier(supplier, mappedType, linkedWorkspace)
    );

    if (mappedType === "Tier3Supplier") {
      byType.RawMaterialSource.push(
        toCatalogItemFromSupplier(supplier, "RawMaterialSource", linkedWorkspace)
      );
    }
  }

  const existingTier1Names = new Set(
    byType.Tier1Supplier.map((item) => String(item.name || "").trim().toLowerCase())
  );

  for (const supplierUser of supplierUsers) {
    const key = String(supplierUser.companyName || "").trim().toLowerCase();
    if (!key || existingTier1Names.has(key)) continue;
    const linkedWorkspace = publishedWorkspaceByKey.get(normalizeLookupKey(supplierUser.companyName)) || null;
    byType.Tier1Supplier.push(toCatalogItemFromUser(supplierUser, linkedWorkspace));
    existingTier1Names.add(key);
  }

  return byType;
};

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

const getImportedComponentNodeIds = async ({ workspaceId, sourceWorkspaceId, entryNodeId }) => {
  if (!workspaceId || !sourceWorkspaceId || !entryNodeId) {
    return new Set();
  }

  const importedNodes = await Node.find({
    workspace: workspaceId,
    imported: true,
    sourceWorkspace: sourceWorkspaceId,
  })
    .select("id")
    .lean();

  const importedNodeIds = importedNodes.map((node) => node.id);
  const importedNodeSet = new Set(importedNodeIds);

  if (!importedNodeSet.has(entryNodeId)) {
    return new Set();
  }

  const importedEdges = await Edge.find({
    workspace: workspaceId,
    imported: true,
    $or: [
      { source_node: { $in: importedNodeIds } },
      { target_node: { $in: importedNodeIds } },
    ],
  })
    .select("source_node target_node")
    .lean();

  const adjacency = new Map();
  for (const edge of importedEdges) {
    if (!importedNodeSet.has(edge.source_node) || !importedNodeSet.has(edge.target_node)) {
      continue;
    }

    if (!adjacency.has(edge.source_node)) adjacency.set(edge.source_node, []);
    if (!adjacency.has(edge.target_node)) adjacency.set(edge.target_node, []);
    adjacency.get(edge.source_node).push(edge.target_node);
    adjacency.get(edge.target_node).push(edge.source_node);
  }

  const componentNodes = new Set([entryNodeId]);
  const queue = [entryNodeId];

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjacency.get(current) || [];

    for (const neighbor of neighbors) {
      if (componentNodes.has(neighbor)) continue;
      componentNodes.add(neighbor);
      queue.push(neighbor);
    }
  }

  return componentNodes;
};

const deleteImportedNetworksAnchoredAtNode = async ({ workspaceId, anchorNodeId }) => {
  const outgoingEdges = await Edge.find({
    workspace: workspaceId,
    source_node: anchorNodeId,
  })
    .select("target_node")
    .lean();

  if (outgoingEdges.length === 0) {
    return { removedImportedNodes: 0, removedImportedEdges: 0 };
  }

  const candidateTargetIds = [...new Set(outgoingEdges.map((edge) => edge.target_node))];

  const importedEntryNodes = await Node.find({
    workspace: workspaceId,
    id: { $in: candidateTargetIds },
    imported: true,
  })
    .select("id sourceWorkspace")
    .lean();

  if (importedEntryNodes.length === 0) {
    return { removedImportedNodes: 0, removedImportedEdges: 0 };
  }

  const nodesToDelete = new Set();
  for (const entryNode of importedEntryNodes) {
    if (!entryNode.sourceWorkspace) {
      continue;
    }

    const componentNodes = await getImportedComponentNodeIds({
      workspaceId,
      sourceWorkspaceId: entryNode.sourceWorkspace,
      entryNodeId: entryNode.id,
    });

    componentNodes.forEach((nodeId) => nodesToDelete.add(nodeId));
  }

  if (nodesToDelete.size === 0) {
    return { removedImportedNodes: 0, removedImportedEdges: 0 };
  }

  const importedNodeIds = [...nodesToDelete];

  const [edgeDeleteResult, nodeDeleteResult] = await Promise.all([
    Edge.deleteMany({
      workspace: workspaceId,
      $or: [
        { source_node: { $in: importedNodeIds } },
        { target_node: { $in: importedNodeIds } },
      ],
    }),
    Node.deleteMany({
      workspace: workspaceId,
      imported: true,
      id: { $in: importedNodeIds },
    }),
  ]);

  return {
    removedImportedNodes: nodeDeleteResult?.deletedCount || 0,
    removedImportedEdges: edgeDeleteResult?.deletedCount || 0,
  };
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
    linkedWorkspace,
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
    linkedWorkspace: linkedWorkspace && mongoose.Types.ObjectId.isValid(linkedWorkspace)
      ? linkedWorkspace
      : null,
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

  const node = await Node.findOne({ id });

  if (!node) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `Node ${id} not found`,
    });
  }

  const workspaceId = node.workspace;

  const { removedImportedNodes, removedImportedEdges } =
    await deleteImportedNetworksAnchoredAtNode({
      workspaceId,
      anchorNodeId: id,
    });

  await Node.deleteOne({ _id: node._id });

  const edgeDeleteResult = await Edge.deleteMany({
    workspace: workspaceId,
    $or: [{ source_node: id }, { target_node: id }],
  });

  await syncWorkspaceCounts(workspaceId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Node ${id} and connected edges deleted`,
    removedImportedNodes,
    removedImportedEdges,
    removedAnchorEdges: edgeDeleteResult?.deletedCount || 0,
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
  // Priority 1: derive catalog from pharma CSV schema/data.
  const pharmaData = getPharmaCatalogAndSchema();
  const pharmaCatalog = pharmaData.catalog || {};
  const supplierCatalog = await loadSupplierCatalog();

  const dbFilter = {};
  if (type) dbFilter.type = type;
  const dbItems = await CatalogItem.find(dbFilter).sort({ type: 1, name: 1 }).lean();

  const dbCatalog = {};
  for (const item of dbItems) {
    if (!dbCatalog[item.type]) dbCatalog[item.type] = [];
    dbCatalog[item.type].push(item);
  }

  const mergedCatalogByType = {
    ...nodeCatalog,
  };

  const appendCatalog = (sourceCatalog = {}) => {
    for (const [key, items] of Object.entries(sourceCatalog)) {
      if (!Array.isArray(items) || items.length === 0) continue;
      mergedCatalogByType[key] = [...(mergedCatalogByType[key] || []), ...items];
    }
  };

  appendCatalog(pharmaCatalog);
  appendCatalog(dbCatalog);
  appendCatalog(supplierCatalog);

  const dedupedCatalog = {};
  for (const [key, items] of Object.entries(mergedCatalogByType)) {
    dedupedCatalog[key] = dedupeCatalogItems(items);
  }

  const hasPharma = Object.values(pharmaCatalog).some((items) => Array.isArray(items) && items.length > 0);
  const hasDb = dbItems.length > 0;
  const hasSuppliers = Object.values(supplierCatalog).some((items) => Array.isArray(items) && items.length > 0);

  let source = "static_fallback";
  if (hasPharma || hasDb || hasSuppliers) source = "merged";

  if (type) {
    return res.status(StatusCodes.OK).json({
      success: true,
      source,
      catalog: { [type]: dedupedCatalog[type] || [] },
      schema: pharmaData.schemaAnalysis,
    });
  }

  res.status(StatusCodes.OK).json({
    success: true,
    source,
    catalog: dedupedCatalog,
    schema: pharmaData.schemaAnalysis,
  });
};

const getPharmaSchemaAnalysis = async (_req, res) => {
  const pharmaData = getPharmaCatalogAndSchema();
  res.status(StatusCodes.OK).json({
    success: true,
    csvPath: pharmaData.csvPath,
    schema: pharmaData.schemaAnalysis,
  });
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
  getPharmaSchemaAnalysis,
};
