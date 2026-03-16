const { StatusCodes } = require("http-status-codes");
const Workspace = require("../models/Workspace");
const { Node } = require("../models/Node");
const Edge = require("../models/Edge");

const listPublished = async (req, res) => {
  const { search, tags, sort = "newest", page = 1, limit = 12 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = { isPublished: true };

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [{ name: regex }, { publisherName: regex }, { description: regex }];
  }

  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) filter.tags = { $in: tagList };
  }

  const sortOption = sort === "popular" ? { importCount: -1 } : { publishedAt: -1 };

  const [workspaces, total] = await Promise.all([
    Workspace.find(filter).sort(sortOption).skip(skip).limit(Number(limit)).lean(),
    Workspace.countDocuments(filter),
  ]);

  // Enrich with live counts and country summary
  const enriched = await Promise.all(
    workspaces.map(async (ws) => {
      const [nodeCount, edgeCount, countries] = await Promise.all([
        Node.countDocuments({ workspace: ws._id }),
        Edge.countDocuments({ workspace: ws._id }),
        Node.distinct("country", { workspace: ws._id, country: { $ne: "" } }),
      ]);
      return { ...ws, nodeCount, edgeCount, countries };
    })
  );

  res.status(StatusCodes.OK).json({
    success: true,
    workspaces: enriched,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
  });
};

const getPublishedDetail = async (req, res) => {
  const ws = await Workspace.findById(req.params.id).lean();
  if (!ws || !ws.isPublished) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Published workspace not found" });
  }

  const [nodeCount, edgeCount, countries, nodeTypes, avgRisk] = await Promise.all([
    Node.countDocuments({ workspace: ws._id }),
    Edge.countDocuments({ workspace: ws._id }),
    Node.distinct("country", { workspace: ws._id, country: { $ne: "" } }),
    Node.aggregate([
      { $match: { workspace: ws._id } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
    Node.aggregate([
      { $match: { workspace: ws._id } },
      { $group: { _id: null, avg: { $avg: "$risk_score" } } },
    ]),
  ]);

  res.status(StatusCodes.OK).json({
    success: true,
    workspace: {
      ...ws,
      nodeCount,
      edgeCount,
      countries,
      nodeTypeDistribution: nodeTypes,
      avgRiskScore: avgRisk[0]?.avg || 0,
    },
  });
};

const previewPublished = async (req, res) => {
  const ws = await Workspace.findById(req.params.id).lean();
  if (!ws || !ws.isPublished) {
    return res
      .status(StatusCodes.NOT_FOUND)
      .json({ success: false, message: "Published workspace not found" });
  }

  const [nodes, edges] = await Promise.all([
    Node.find({ workspace: ws._id }).lean(),
    Edge.find({ workspace: ws._id }).lean(),
  ]);

  // Convert to ReactFlow format
  const rfNodes = nodes.map((n) => ({
    id: n.id,
    position: n.position || { x: 0, y: 0 },
    data: {
      id: n.id,
      name: n.name,
      type: n.type,
      country: n.country,
      region: n.region,
      risk_score: n.risk_score,
      lead_time_days: n.lead_time_days,
      reliability_score: n.reliability_score,
    },
    type: "supplyNode",
  }));

  const rfEdges = edges.map((e) => ({
    id: e.edge_id,
    source: e.source_node,
    target: e.target_node,
    data: {
      material: e.material,
      lead_time: e.lead_time,
      dependency_percent: e.dependency_percent,
    },
    animated: false,
    markerEnd: { type: "arrowclosed" },
  }));

  res.status(StatusCodes.OK).json({
    success: true,
    workspace: ws,
    nodes: rfNodes,
    edges: rfEdges,
  });
};

module.exports = { listPublished, getPublishedDetail, previewPublished };
