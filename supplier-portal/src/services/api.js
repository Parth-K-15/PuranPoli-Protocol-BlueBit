import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const api = axios.create({ baseURL: API_BASE });

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("supplier_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  register: async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    return data;
  },
  login: async (payload) => {
    const { data } = await api.post("/auth/login", payload);
    return data;
  },
  me: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  },
};

// ── Workspaces ──────────────────────────────────────────────────────────────
export const workspaceApi = {
  listMine: async () => {
    const { data } = await api.get("/workspaces/mine");
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
  publish: async (id, payload) => {
    const { data } = await api.patch(`/workspaces/${id}/publish`, payload);
    return data;
  },
  unpublish: async (id) => {
    const { data } = await api.patch(`/workspaces/${id}/unpublish`);
    return data;
  },
  pasteNetwork: async (targetWorkspaceId, payload) => {
    const { data } = await api.post(`/workspaces/${targetWorkspaceId}/paste-network`, payload);
    return data;
  },
  viewSupplierNetwork: async (targetWorkspaceId, payload) => {
    const { data } = await api.post(`/workspaces/${targetWorkspaceId}/supplier-network/view`, payload);
    return data;
  },
  collapseSupplierNetwork: async (targetWorkspaceId, payload) => {
    const { data } = await api.post(`/workspaces/${targetWorkspaceId}/supplier-network/collapse`, payload);
    return data;
  },
};

// ── Graph ───────────────────────────────────────────────────────────────────
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
    const { data } = await api.post("/graph/demo", {}, { params });
    return data;
  },
};
