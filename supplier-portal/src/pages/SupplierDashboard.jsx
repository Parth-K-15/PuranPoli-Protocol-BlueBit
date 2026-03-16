import { useCallback, useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { workspaceApi } from "../services/api";

const NETWORK_CLIPBOARD_KEY = "supplier_network_clipboard";

const readNetworkClipboard = () => {
  try {
    const raw = localStorage.getItem(NETWORK_CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.workspaceId || !parsed?.workspaceName) return null;
    return parsed;
  } catch {
    return null;
  }
};

export default function SupplierDashboard() {
  const navigate = useNavigate();
  const { workspaces, setWorkspaces } = useOutletContext();
  const [loading, setLoading] = useState(!workspaces?.length);
  const [pastingWorkspaceId, setPastingWorkspaceId] = useState(null);
  const [networkClipboard, setNetworkClipboard] = useState(readNetworkClipboard);

  const refreshWorkspaces = useCallback(async () => {
    const data = await workspaceApi.listMine();
    setWorkspaces(data.workspaces ?? data ?? []);
  }, [setWorkspaces]);

  useEffect(() => {
    refreshWorkspaces()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshWorkspaces]);

  const saveClipboard = (nextClipboard) => {
    setNetworkClipboard(nextClipboard);
    if (!nextClipboard) {
      localStorage.removeItem(NETWORK_CLIPBOARD_KEY);
      return;
    }
    localStorage.setItem(NETWORK_CLIPBOARD_KEY, JSON.stringify(nextClipboard));
  };

  const handleCopyNetwork = (workspace) => {
    saveClipboard({
      workspaceId: workspace._id,
      workspaceName: workspace.name,
      copiedAt: Date.now(),
    });
  };

  const handlePasteNetwork = async (targetWorkspace) => {
    if (!networkClipboard?.workspaceId || !targetWorkspace?._id) return;

    try {
      setPastingWorkspaceId(targetWorkspace._id);
      const result = await workspaceApi.pasteNetwork(targetWorkspace._id, {
        sourceWorkspaceId: networkClipboard.workspaceId,
      });

      await refreshWorkspaces();

      alert(
        `Network pasted successfully: ${result.copiedNodeCount ?? 0} nodes, ${
          result.copiedEdgeCount ?? 0
        } edges.`
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to paste network");
    } finally {
      setPastingWorkspaceId(null);
    }
  };

  const handleCreate = async () => {
    const name = prompt("New workspace name:");
    if (!name?.trim()) return;
    try {
      const data = await workspaceApi.create({ name: name.trim() });
      const ws = data.workspace ?? data;
      setWorkspaces((prev) => [...prev, ws]);
      navigate(`/graph/${ws._id}`);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create workspace");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="material-symbols-outlined animate-spin text-[#6d6fd8]">
            progress_activity
          </span>
          <span className="text-sm">Loading workspaces...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Workspaces</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your supply chain graphs
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 rounded-xl bg-[#6d6fd8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#5b5dc0]"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Create New Workspace
        </button>
      </div>

      {networkClipboard && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#b1b2ff]/30 bg-[#b1b2ff]/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-[#4f52c9]">
            <span className="material-symbols-outlined text-[18px]">content_copy</span>
            <span>
              Copied network: <span className="font-semibold">{networkClipboard.workspaceName}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => saveClipboard(null)}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            Clear
          </button>
        </div>
      )}

      {/* Empty State */}
      {workspaces.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#b1b2ff]/10">
            <span className="material-symbols-outlined text-4xl text-[#b1b2ff]">
              inventory_2
            </span>
          </div>
          <h3 className="text-lg font-semibold text-slate-700">
            No workspaces yet
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">
            Create your first workspace to start building your supply chain
            graph.
          </p>
          <button
            onClick={handleCreate}
            className="mt-5 flex items-center gap-2 rounded-xl bg-[#6d6fd8] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5b5dc0]"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Workspace
          </button>
        </div>
      )}

      {/* Workspace Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workspaces.map((ws) => (
          <div
            key={ws._id}
            onClick={() => navigate(`/graph/${ws._id}`)}
            className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-[#b1b2ff]/40 hover:shadow-md"
          >
            {/* Card Header */}
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b1b2ff]/10 transition-colors group-hover:bg-[#b1b2ff]/20">
                  <span className="material-symbols-outlined text-xl text-[#6d6fd8]">
                    account_tree
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{ws.name}</h3>
                </div>
              </div>
              {/* Publish badge */}
              {ws.isPublished ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Published
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Draft
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="mb-4 flex gap-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="material-symbols-outlined text-[16px]">
                  circle
                </span>
                {ws.nodeCount ?? ws.nodes ?? 0} nodes
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="material-symbols-outlined text-[16px]">
                  trending_flat
                </span>
                {ws.edgeCount ?? ws.edges ?? 0} edges
              </div>
              {(ws.importCount != null || ws.imports != null) && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="material-symbols-outlined text-[16px]">
                    download
                  </span>
                  {ws.importCount ?? ws.imports ?? 0} imports
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/graph/${ws._id}`);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#b1b2ff]/10 px-3 py-1.5 text-xs font-medium text-[#6d6fd8] transition-colors hover:bg-[#b1b2ff]/20"
              >
                <span className="material-symbols-outlined text-[16px]">
                  edit
                </span>
                Build Graph
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/publish/${ws._id}`);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
              >
                <span className="material-symbols-outlined text-[16px]">
                  publish
                </span>
                Publish
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyNetwork(ws);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <span className="material-symbols-outlined text-[16px]">
                  content_copy
                </span>
                Copy Network
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePasteNetwork(ws);
                }}
                disabled={!networkClipboard || pastingWorkspaceId === ws._id}
                className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">
                  content_paste
                </span>
                {pastingWorkspaceId === ws._id ? "Pasting..." : "Paste Here"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
