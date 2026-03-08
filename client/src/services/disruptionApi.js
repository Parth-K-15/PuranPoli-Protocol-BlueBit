import axios from "axios";

const api = axios.create({ baseURL: "/api/v1" });

export const getDisruptions = (params = {}) =>
  api.get("/disruptions", { params }).then((r) => r.data);

export const getHighRisk = () =>
  api.get("/disruptions/high-risk").then((r) => r.data);

export const getStats = () =>
  api.get("/disruptions/stats").then((r) => r.data);

export const triggerIngest = () =>
  api.post("/disruptions/ingest").then((r) => r.data);
