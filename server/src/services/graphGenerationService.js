const { NODE_TYPES } = require("../models/Node");
const { callGraphLlm } = require("./llmProvider");

const draftStore = new Map();

const DEFAULT_CONSTRAINTS = {
  maxNodes: 40,
  maxEdges: 80,
};

const clamp = (value, min, max) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
};

const toPercentScale = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric >= 0 && numeric <= 1) return Math.round(numeric * 100);
  return Math.round(clamp(numeric, 0, 100));
};

const extractCount = (prompt, keyword, defaultValue) => {
  if (!prompt) return defaultValue;
  const regex = new RegExp(`(\\d+)\\s*${keyword}`, "i");
  const match = prompt.match(regex);
  if (!match) return defaultValue;
  return Math.max(1, Number(match[1]) || defaultValue);
};

const buildFallbackDraft = ({ prompt, constraints }) => {
  const manufacturerCount = extractCount(prompt, "manufact", 1);
  const distributorCount = extractCount(prompt, "distributor", 2);
  const retailerCount = extractCount(prompt, "retailer|pharmacy", 3);
  const wantsColdChain = /cold[\s-]?chain|temperature|vaccine|insulin/i.test(prompt || "");

  const nodes = [];
  const edges = [];

  const addNode = (node) => {
    nodes.push({
      country: "India",
      region: "Maharashtra",
      capacity: 5000,
      inventory: 1000,
      risk_score: 20,
      lead_time_days: 5,
      reliability_score: 80,
      dependency_percentage: 30,
      compliance_status: "Compliant",
      gmp_status: "Certified",
      fda_approval: "Approved",
      ...node,
    });
  };

  const addEdge = (edge) => {
    edges.push({
      material: "Pharma Material",
      lead_time: 3,
      dependency_percent: 35,
      transport_mode: "Road",
      risk_score: 15,
      ...edge,
    });
  };

  addNode({ id: "n_raw_1", name: "Raw Material Source", type: "RawMaterialSource", position: { x: 0, y: 80 } });
  addNode({ id: "n_t2_1", name: "Tier 2 Supplier", type: "Tier2Supplier", position: { x: 220, y: 80 } });
  addNode({ id: "n_t1_1", name: "Tier 1 Supplier", type: "Tier1Supplier", position: { x: 440, y: 80 } });

  addEdge({ id: "e_1", source: "n_raw_1", target: "n_t2_1", material: "Raw Compound" });
  addEdge({ id: "e_2", source: "n_t2_1", target: "n_t1_1", material: "Processed API" });

  for (let i = 0; i < manufacturerCount; i += 1) {
    const id = `n_m_${i + 1}`;
    addNode({
      id,
      name: `Manufacturer ${i + 1}`,
      type: "Manufacturer",
      capacity: 9000,
      inventory: 2500,
      position: { x: 680, y: 30 + i * 120 },
    });
    addEdge({ id: `e_m_${i + 1}`, source: "n_t1_1", target: id, material: "API" });
  }

  addNode({ id: "n_wh_1", name: "Central Warehouse", type: "Warehouse", position: { x: 940, y: 80 } });
  for (let i = 0; i < manufacturerCount; i += 1) {
    addEdge({ id: `e_wh_${i + 1}`, source: `n_m_${i + 1}`, target: "n_wh_1", material: "Finished Goods" });
  }

  if (wantsColdChain) {
    addNode({ id: "n_cs_1", name: "Cold Storage Hub", type: "ColdStorage", position: { x: 1160, y: 20 } });
    addEdge({ id: "e_cs_1", source: "n_wh_1", target: "n_cs_1", material: "Temperature Sensitive Stock" });
  }

  for (let i = 0; i < distributorCount; i += 1) {
    const id = `n_d_${i + 1}`;
    addNode({
      id,
      name: `Distributor ${i + 1}`,
      type: "Distributor",
      position: { x: 1160, y: 120 + i * 100 },
    });
    addEdge({ id: `e_d_${i + 1}`, source: wantsColdChain ? "n_cs_1" : "n_wh_1", target: id, material: "Shipped Inventory" });
  }

  for (let i = 0; i < retailerCount; i += 1) {
    const distIndex = (i % distributorCount) + 1;
    const id = `n_r_${i + 1}`;
    addNode({
      id,
      name: `Retailer ${i + 1}`,
      type: "Retailer",
      position: { x: 1410, y: 60 + i * 80 },
    });
    addEdge({ id: `e_r_${i + 1}`, source: `n_d_${distIndex}`, target: id, material: "Final Product" });
  }

  const maxNodes = clamp(constraints.maxNodes ?? DEFAULT_CONSTRAINTS.maxNodes, 5, 200);
  const maxEdges = clamp(constraints.maxEdges ?? DEFAULT_CONSTRAINTS.maxEdges, 5, 300);

  return {
    nodes: nodes.slice(0, maxNodes),
    edges: edges.slice(0, maxEdges),
    assumptions: [
      "Generated a baseline pharma chain from supplier to retailer.",
      wantsColdChain ? "Cold chain was included based on prompt signals." : "Cold chain was not included.",
    ],
    warnings: ["Fallback template used; refine prompt and regenerate for a more specific topology."],
  };
};

const normalizeDraft = (rawDraft, constraints = {}) => {
  const maxNodes = clamp(constraints.maxNodes ?? DEFAULT_CONSTRAINTS.maxNodes, 5, 200);
  const maxEdges = clamp(constraints.maxEdges ?? DEFAULT_CONSTRAINTS.maxEdges, 5, 300);

  const rawNodes = Array.isArray(rawDraft?.nodes) ? rawDraft.nodes : [];
  const rawEdges = Array.isArray(rawDraft?.edges) ? rawDraft.edges : [];

  const nodeIdMap = new Map();
  const nodes = [];

  for (let index = 0; index < rawNodes.length && nodes.length < maxNodes; index += 1) {
    const item = rawNodes[index] || {};
    const type = NODE_TYPES.includes(item.type) ? item.type : "Distributor";
    const baseId = String(item.id || `n_${index + 1}`).trim();
    const uniqueId = nodeIdMap.has(baseId) ? `${baseId}_${index + 1}` : baseId;
    nodeIdMap.set(baseId, uniqueId);

    nodes.push({
      id: uniqueId,
      name: String(item.name || `${type}_${index + 1}`).trim(),
      type,
      country: String(item.country || "India").trim(),
      region: String(item.region || "").trim(),
      capacity: Math.max(0, Number(item.capacity) || 0),
      inventory: Math.max(0, Number(item.inventory) || 0),
      risk_score: toPercentScale(item.risk_score, 20),
      lead_time_days: Math.max(0, Number(item.lead_time_days) || 0),
      reliability_score: toPercentScale(item.reliability_score, 75),
      dependency_percentage: toPercentScale(item.dependency_percentage, 25),
      compliance_status: String(item.compliance_status || "Unknown").trim(),
      gmp_status: ["Certified", "Pending", "Non-Compliant", "Unknown"].includes(item.gmp_status)
        ? item.gmp_status
        : "Unknown",
      fda_approval: ["Approved", "Pending", "Not Required", "Rejected", "Unknown"].includes(item.fda_approval)
        ? item.fda_approval
        : "Unknown",
      cold_chain_capable: Boolean(item.cold_chain_capable),
      cost: Math.max(0, Number(item.cost) || 0),
      moq: Math.max(0, Number(item.moq) || 0),
      contract_duration_months: Math.max(0, Number(item.contract_duration_months) || 0),
      batch_cycle_time_days: Math.max(0, Number(item.batch_cycle_time_days) || 0),
      financial_health_score: toPercentScale(item.financial_health_score, 65),
      position: {
        x: Number(item?.position?.x) || (index % 6) * 260,
        y: Number(item?.position?.y) || Math.floor(index / 6) * 140,
      },
    });
  }

  const validNodeIds = new Set(nodes.map((node) => node.id));
  const usedEdgeIds = new Set();
  const seenPair = new Set();
  const edges = [];

  for (let index = 0; index < rawEdges.length && edges.length < maxEdges; index += 1) {
    const edge = rawEdges[index] || {};
    const source = String(edge.source || edge.source_node || "").trim();
    const target = String(edge.target || edge.target_node || "").trim();

    if (!validNodeIds.has(source) || !validNodeIds.has(target)) continue;

    const pairKey = `${source}__${target}`;
    if (seenPair.has(pairKey)) continue;
    seenPair.add(pairKey);

    const baseId = String(edge.id || edge.edge_id || `e_${index + 1}`).trim();
    const edgeId = usedEdgeIds.has(baseId) ? `${baseId}_${index + 1}` : baseId;
    usedEdgeIds.add(edgeId);

    edges.push({
      id: edgeId,
      source,
      target,
      material: String(edge.material || "").trim(),
      lead_time: Math.max(0, Number(edge.lead_time) || 0),
      dependency_percent: toPercentScale(edge.dependency_percent, 30),
      transport_mode: String(edge.transport_mode || "Road").trim(),
      risk_score: toPercentScale(edge.risk_score, 15),
    });
  }

  return {
    nodes,
    edges,
    assumptions: Array.isArray(rawDraft?.assumptions) ? rawDraft.assumptions.slice(0, 8).map((x) => String(x)) : [],
    warnings: Array.isArray(rawDraft?.warnings) ? rawDraft.warnings.slice(0, 8).map((x) => String(x)) : [],
  };
};

const generateGraphDraft = async ({ prompt, constraints = {} }) => {
  const providerResponse = await callGraphLlm({
    prompt,
    constraints,
    allowedNodeTypes: NODE_TYPES,
  });

  if (providerResponse.success) {
    const normalized = normalizeDraft(providerResponse.data, constraints);

    // Some providers may return syntactically valid JSON with unusable payloads.
    // In that case, downgrade to template fallback instead of failing the request.
    if (normalized.nodes.length > 0) {
      return {
        ...normalized,
        provider: providerResponse.provider,
        model: providerResponse.model,
        fallbackUsed: false,
      };
    }

    const fallbackFromEmpty = buildFallbackDraft({ prompt, constraints });
    const normalizedFallbackFromEmpty = normalizeDraft(fallbackFromEmpty, constraints);
    const warnings = [...normalizedFallbackFromEmpty.warnings];
    warnings.unshift(
      `LLM provider returned empty graph payload from ${providerResponse.provider}; using fallback template`
    );

    return {
      ...normalizedFallbackFromEmpty,
      warnings,
      provider: "fallback-template",
      model: null,
      fallbackUsed: true,
    };
  }

  const fallback = buildFallbackDraft({ prompt, constraints });
  const normalizedFallback = normalizeDraft(fallback, constraints);

  const warnings = [...normalizedFallback.warnings];
  if (providerResponse.reason) {
    warnings.unshift(`LLM provider unavailable: ${providerResponse.reason}`);
  }

  return {
    ...normalizedFallback,
    warnings,
    provider: "fallback-template",
    model: null,
    fallbackUsed: true,
  };
};

const createGenerationId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `gen_${timestamp}_${random}`;
};

const storeDraft = ({ workspaceId = null, prompt, draft }) => {
  const generationId = createGenerationId();
  draftStore.set(generationId, {
    workspaceId,
    prompt,
    draft,
    createdAt: Date.now(),
  });
  return generationId;
};

const getDraft = (generationId) => {
  const record = draftStore.get(generationId);
  if (!record) return null;

  const ttlMs = Number(process.env.GRAPH_DRAFT_TTL_MS || 30 * 60 * 1000);
  if (Date.now() - record.createdAt > ttlMs) {
    draftStore.delete(generationId);
    return null;
  }

  return record;
};

const deleteDraft = (generationId) => {
  draftStore.delete(generationId);
};

module.exports = {
  generateGraphDraft,
  storeDraft,
  getDraft,
  deleteDraft,
};
