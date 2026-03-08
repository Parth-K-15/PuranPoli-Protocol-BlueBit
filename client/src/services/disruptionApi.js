import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
const api = axios.create({ baseURL: API_BASE_URL });

export const getDisruptions = (params = {}) =>
  api.get("/disruptions", { params }).then((r) => r.data);

export const getHighRisk = () =>
  api.get("/disruptions/high-risk").then((r) => r.data);

export const getStats = () =>
  api.get("/disruptions/stats").then((r) => r.data);

export const triggerIngest = () =>
  api.post("/disruptions/ingest").then((r) => r.data);
