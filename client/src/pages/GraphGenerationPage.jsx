import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";

import GraphCanvas from "../components/GraphCanvas";
import { graphApi, workspaceApi } from "../services/api";
import { clearGraphDraftSession, saveGraphDraftSession } from "../utils/graphDraftSession";

function GraphGenerationPage() {
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [llmPrompt, setLlmPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationId, setGenerationId] = useState("");
  const [generationDraft, setGenerationDraft] = useState(null);
  const [generationWarnings, setGenerationWarnings] = useState([]);
  const [generationAssumptions, setGenerationAssumptions] = useState([]);
  const [generationError, setGenerationError] = useState("");
  const [previewRefreshToken, setPreviewRefreshToken] = useState(0);

  const normalizeWorkspace = (workspace) => {
    if (!workspace) return null;
    const id = String(workspace._id || workspace.id || "").trim();
    if (!id) return null;
    return {
      ...workspace,
      _id: id,
      name: workspace.name || "Untitled Workspace",
    };
  };

  const loadWorkspaces = useCallback(async () => {
    setIsLoadingWorkspaces(true);
    setWorkspaceError("");

    try {
      const res = await workspaceApi.list();
      let list = (res.workspaces || []).map(normalizeWorkspace).filter(Boolean);

      if (list.length === 0) {
        const created = await workspaceApi.create({ name: "Default Workspace" });
        list = [normalizeWorkspace(created.workspace)].filter(Boolean);
      }

      setWorkspaces(list);

      const persisted = String(localStorage.getItem("activeWorkspaceId") || "").trim();
      const selected =
        list.find((w) => w._id === persisted)?._id ||
        list[0]?._id ||
        "";

      setActiveWorkspaceId(selected);
      if (selected) {
        localStorage.setItem("activeWorkspaceId", selected);
      }
    } catch (error) {
      console.error("Failed to load workspaces", error);
      setWorkspaceError(
        error?.response?.data?.message ||
          "Unable to load workspaces. Ensure backend server is running on port 5000."
      );
      setWorkspaces([]);
      setActiveWorkspaceId("");
    } finally {
      setIsLoadingWorkspaces(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  const handleCreateWorkspace = async () => {
    const name = window.prompt("Enter a name for the new workspace:", "New Workspace");
    if (!name || !name.trim()) return;

    try {
      const created = await workspaceApi.create({ name: name.trim() });
      const nextWorkspace = normalizeWorkspace(created.workspace);
      if (!nextWorkspace) return;

      setWorkspaces((prev) => [nextWorkspace, ...prev]);
      setActiveWorkspaceId(nextWorkspace._id);
      localStorage.setItem("activeWorkspaceId", nextWorkspace._id);
      setWorkspaceError("");
    } catch (error) {
      setWorkspaceError(
        error?.response?.data?.message || "Failed to create workspace."
      );
    }
  };

  const handleGenerateDraft = async () => {
    if (!activeWorkspaceId || !llmPrompt.trim()) {
      return;
    }

    setIsGenerating(true);
    setGenerationError("");

    try {
      const res = await graphApi.autoGenerate({
        workspaceId: activeWorkspaceId,
        prompt: llmPrompt.trim(),
        constraints: {
          maxNodes: 40,
          maxEdges: 80,
        },
      });

      const nextGenerationId = res.generationId || "";
      const nextDraft = res.draft || null;
      const nextWarnings = res.warnings || [];
      const nextAssumptions = res.assumptions || [];

      setGenerationId(nextGenerationId);
      setGenerationDraft(nextDraft);
      setGenerationWarnings(nextWarnings);
      setGenerationAssumptions(nextAssumptions);

      if (nextGenerationId && nextDraft) {
        saveGraphDraftSession({
          generationId: nextGenerationId,
          draft: nextDraft,
          warnings: nextWarnings,
          assumptions: nextAssumptions,
          workspaceId: activeWorkspaceId,
          prompt: llmPrompt.trim(),
        });
      }
    } catch (error) {
      setGenerationError(
        error?.response?.data?.message ||
          "Failed to generate draft graph. Please refine your prompt and try again."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInBuilder = () => {
    if (!activeWorkspaceId) return;
    navigate(`/app/graph?workspace=${activeWorkspaceId}`);
  };

  const handleClearDraft = () => {
    setGenerationId("");
    setGenerationDraft(null);
    setGenerationWarnings([]);
    setGenerationAssumptions([]);
    setGenerationError("");
    clearGraphDraftSession();
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[#f8f6ff] px-4 py-6 sm:px-6">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <header className="rounded-2xl border border-[#b1b2ff]/20 bg-white p-5 shadow-sm">
          <h1 className="text-xl font-black tracking-tight text-slate-900">Graph Prompt Studio</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate drafts here, then open Graph Builder to inspect and approve.
          </p>
        </header>

        <section className="rounded-2xl border border-[#b1b2ff]/20 bg-white p-5 shadow-sm">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="workspace-select">
            Workspace
          </label>
          <select
            id="workspace-select"
            value={activeWorkspaceId}
            onChange={(event) => {
              const nextWorkspaceId = String(event.target.value || "");
              setActiveWorkspaceId(nextWorkspaceId);
              localStorage.setItem("activeWorkspaceId", nextWorkspaceId);
            }}
            disabled={isLoadingWorkspaces || workspaces.length === 0}
            className="mb-4 w-full rounded-xl border border-[#b1b2ff]/20 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#6d6fd8]/40 focus:ring-2 focus:ring-[#b1b2ff]/20"
          >
            {workspaces.length === 0 && (
              <option value="">
                {isLoadingWorkspaces ? "Loading workspaces..." : "No workspace available"}
              </option>
            )}
            {workspaces.map((ws) => (
              <option key={ws._id} value={ws._id}>
                {ws.name}
              </option>
            ))}
          </select>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadWorkspaces}
              disabled={isLoadingWorkspaces}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingWorkspaces ? "Refreshing..." : "Refresh Workspaces"}
            </button>
            <button
              type="button"
              onClick={handleCreateWorkspace}
              className="rounded-xl border border-[#b1b2ff]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#6d6fd8] hover:bg-[#b1b2ff]/5"
            >
              New Workspace
            </button>
          </div>

          {workspaceError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {workspaceError}
            </p>
          )}

          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500" htmlFor="llm-graph-prompt-page">
            Prompt
          </label>
          <textarea
            id="llm-graph-prompt-page"
            value={llmPrompt}
            onChange={(event) => setLlmPrompt(event.target.value)}
            placeholder="Example: 2 manufacturers in Maharashtra, 1 cold storage, 3 distributors, 8 retailers."
            className="min-h-[140px] w-full rounded-xl border border-[#b1b2ff]/20 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-[#6d6fd8]/40 focus:ring-2 focus:ring-[#b1b2ff]/20"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={!activeWorkspaceId || isGenerating || !llmPrompt.trim()}
              className="rounded-xl bg-[#6d6fd8] px-4 py-2 text-xs font-bold text-white hover:bg-[#5d5fc8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "Generating..." : "Generate Draft"}
            </button>

            <button
              type="button"
              onClick={handleOpenInBuilder}
              disabled={!activeWorkspaceId}
              className="rounded-xl border border-[#b1b2ff]/30 bg-white px-4 py-2 text-xs font-bold text-[#6d6fd8] hover:bg-[#b1b2ff]/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Open In Graph Builder
            </button>

            <button
              type="button"
              onClick={handleClearDraft}
              disabled={!generationId}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear Draft
            </button>

            {generationId && (
              <span className="rounded-full bg-[#b1b2ff]/15 px-2 py-1 text-[11px] font-semibold text-[#6d6fd8]">
                Draft ID: {generationId}
              </span>
            )}
          </div>

          {generationError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
              {generationError}
            </p>
          )}

          {generationWarnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <p className="mb-1 font-bold">Warnings</p>
              <ul className="list-disc pl-4">
                {generationWarnings.slice(0, 4).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {generationAssumptions.length > 0 && (
            <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
              <p className="mb-1 font-bold">Assumptions</p>
              <ul className="list-disc pl-4">
                {generationAssumptions.slice(0, 4).map((assumption) => (
                  <li key={assumption}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[#b1b2ff]/20 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-600">
              Draft Graph Workspace
            </h2>
            {generationDraft && (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                Preview Ready
              </span>
            )}
          </div>

          {!generationDraft ? (
            <div className="rounded-xl border border-dashed border-[#b1b2ff]/30 bg-[#f8f6ff] px-4 py-10 text-center text-sm text-slate-500">
              Generate a draft to preview the graph workspace here.
            </div>
          ) : (
            <div className="h-[560px] overflow-hidden rounded-xl border border-[#b1b2ff]/15 bg-white">
              <ReactFlowProvider>
                <GraphCanvas
                  onNodeSelect={() => {}}
                  refreshToken={previewRefreshToken}
                  setRefreshToken={setPreviewRefreshToken}
                  workspaceId={null}
                  generatedDraft={generationDraft}
                  readOnly
                />
              </ReactFlowProvider>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default GraphGenerationPage;
