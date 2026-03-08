const { StatusCodes } = require("http-status-codes");

const { Node, NODE_TYPES } = require("../models/Node");
const Edge = require("../models/Edge");
const { demoNodes, demoEdges } = require("../data/demoGraph");

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

const getGraph = async (req, res) => {
  const [nodes, edges] = await Promise.all([
    Node.find({}).lean(),
    Edge.find({}).lean(),
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
    position,
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

  const node = await Node.create({
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
    position,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    node: toReactFlowNode(node),
  });
};

const updateNode = async (req, res) => {
  const { id } = req.params;
  const payload = req.body;

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

  await Edge.deleteMany({ $or: [{ source_node: id }, { target_node: id }] });

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
  } = req.body;

  if (!edge_id || !source_node || !target_node) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "edge_id, source_node and target_node are required",
    });
  }

  const [sourceExists, targetExists] = await Promise.all([
    Node.exists({ id: source_node }),
    Node.exists({ id: target_node }),
  ]);

  if (!sourceExists || !targetExists) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Source or target node does not exist",
    });
  }

  const edge = await Edge.create({
    edge_id,
    source_node,
    target_node,
    material,
    lead_time,
    dependency_percent,
    transport_mode,
    risk_score,
  });

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

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Edge ${id} deleted`,
  });
};

const loadDemo = async (req, res) => {
  await Promise.all([Node.deleteMany({}), Edge.deleteMany({})]);
  await Node.insertMany(demoNodes);
  await Edge.insertMany(demoEdges);

  const [nodes, edges] = await Promise.all([
    Node.find({}).lean(),
    Edge.find({}).lean(),
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Demo graph loaded",
    nodes: nodes.map(toReactFlowNode),
    edges: edges.map(toReactFlowEdge),
  });
};

module.exports = {
  getGraph,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  deleteEdge,
  loadDemo,
};
