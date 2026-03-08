import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
const ANALYTICS_API_BASE_URL =
  import.meta.env.VITE_ANALYTICS_API_URL || "http://localhost:8001";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const analyticsApiClient = axios.create({
  baseURL: ANALYTICS_API_BASE_URL,
});

// ── Workspace API ───────────────────────────────────────────────────────────
export const workspaceApi = {
  list: async () => {
    const { data } = await api.get("/workspaces");
    return data;
  },
  get: async (id) => {
    const { data } = await api.get(`/workspaces/${id}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/workspaces", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.patch(`/workspaces/${id}`, payload);
    return data;
  },
  delete: async (id) => {
    const { data } = await api.delete(`/workspaces/${id}`);
    return data;
  },
};

// ── Graph API (workspace-scoped) ────────────────────────────────────────────
export const graphApi = {
  getGraph: async (workspaceId) => {
    const params = workspaceId ? { workspace: workspaceId } : {};
    const { data } = await api.get("/graph", { params });
    return data;
  },
  getNodeCatalog: async (type) => {
    const params = type ? { type } : {};
    const { data } = await api.get("/nodes/catalog", { params });
    return data;
  },
  getNodeCatalogSchema: async () => {
    const { data } = await api.get("/nodes/catalog/schema");
    return data;
  },
  createNode: async (payload) => {
    const { data } = await api.post("/nodes", payload);
    return data;
  },
  updateNode: async (id, payload) => {
    const { data } = await api.patch(`/nodes/${id}`, payload);
    return data;
  },
  deleteNode: async (id) => {
    const { data } = await api.delete(`/nodes/${id}`);
    return data;
  },
  createEdge: async (payload) => {
    const { data } = await api.post("/edges", payload);
    return data;
  },
  deleteEdge: async (id) => {
    const { data } = await api.delete(`/edges/${id}`);
    return data;
  },
  loadDemo: async (workspaceId) => {
    const params = workspaceId ? { workspace: workspaceId } : {};
    const { data } = await api.post("/graph/demo", null, { params });
    return data;
  },
  resetGraph: async (workspaceId) => {
    const params = workspaceId ? { workspace: workspaceId } : {};
    const { data } = await api.post("/graph/reset", null, { params });
    return data;
  },
  computeRisks: async (workspaceId) => {
    const params = workspaceId ? { workspace: workspaceId } : {};
    const { data } = await api.post("/graph/compute-risks", null, { params });
    return data;
  },
  getNodeDisruptions: async (nodeId) => {
    const { data } = await api.get(`/nodes/${nodeId}/disruptions`);
    return data;
  },
  getNodeIntelligence: async (nodeId) => {
    const { data } = await api.get(`/nodes/${nodeId}/intelligence`);
    return data;
  },
};

// ── Catalog API (entity catalog CRUD) ───────────────────────────────────────
export const catalogApi = {
  list: async (type, search) => {
    const params = {};
    if (type) params.type = type;
    if (search) params.search = search;
    const { data } = await api.get("/catalog", { params });
    return data;
  },
  get: async (catalogId) => {
    const { data } = await api.get(`/catalog/${catalogId}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/catalog", payload);
    return data;
  },
  update: async (catalogId, payload) => {
    const { data } = await api.patch(`/catalog/${catalogId}`, payload);
    return data;
  },
  delete: async (catalogId) => {
    const { data } = await api.delete(`/catalog/${catalogId}`);
    return data;
  },
  seed: async () => {
    const { data } = await api.post("/catalog/seed");
    return data;
  },
};

// ── Supplier API (pharma supplier CRUD + CSV import) ────────────────────────
export const supplierApi = {
  list: async (params = {}) => {
    const { data } = await api.get("/suppliers", { params });
    return data;
  },
  get: async (id) => {
    const { data } = await api.get(`/suppliers/${id}`);
    return data;
  },
  create: async (payload) => {
    const { data } = await api.post("/suppliers", payload);
    return data;
  },
  update: async (id, payload) => {
    const { data } = await api.patch(`/suppliers/${id}`, payload);
    return data;
  },
  delete: async (id) => {
    const { data } = await api.delete(`/suppliers/${id}`);
    return data;
  },
  importCsv: async () => {
    const { data } = await api.post("/suppliers/import-csv");
    return data;
  },
  clearAll: async () => {
    const { data } = await api.delete("/suppliers/clear-all");
    return data;
  },
};

export const analyticsApi = {
  predictGraph: async (payload) => {
    const { data } = await analyticsApiClient.post("/analytics/predict-graph", payload);
    return data;
  },
  getOverview: async () => {
    const { data } = await analyticsApiClient.get("/analytics/overview");
    return data;
  },
  getSinglePointOfFailure: async (limit = 20) => {
    const { data } = await analyticsApiClient.get(
      "/analytics/single-point-of-failure",
      { params: { limit } }
    );
    return data;
  },
  getGeographicConcentration: async (top_n = 10) => {
    const { data } = await analyticsApiClient.get(
      "/analytics/geographic-concentration",
      { params: { top_n } }
    );
    return data;
  },
  getSupplierReliability: async (limit = 20) => {
    const { data } = await analyticsApiClient.get(
      "/analytics/supplier-reliability",
      { params: { limit } }
    );
    return data;
  },
  getDemandSupplyMismatch: async (limit = 20) => {
    const { data } = await analyticsApiClient.get(
      "/analytics/demand-supply-mismatch",
      { params: { limit } }
    );
    return data;
  },
};

export default api;
