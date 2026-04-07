const GRAPH_DRAFT_STORAGE_KEY = "graph_generation_draft_v1";

export const loadGraphDraftSession = () => {
  try {
    const raw = window.localStorage.getItem(GRAPH_DRAFT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.generationId || !parsed.draft) return null;

    return parsed;
  } catch (_error) {
    return null;
  }
};

export const saveGraphDraftSession = (payload) => {
  window.localStorage.setItem(GRAPH_DRAFT_STORAGE_KEY, JSON.stringify(payload));
};

export const clearGraphDraftSession = () => {
  window.localStorage.removeItem(GRAPH_DRAFT_STORAGE_KEY);
};
