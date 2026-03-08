import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
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
};

export default api;
