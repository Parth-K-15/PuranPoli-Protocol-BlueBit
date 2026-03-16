import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";

import GraphCanvas from "../components/GraphCanvas";
import NodeDetailsPanel from "../components/NodeDetailsPanel";
import NodeSidebar from "../components/NodeSidebar";
import { graphApi, workspaceApi } from "../services/api";

function GraphBuilderPage() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [isComputingRisks, setIsComputingRisks] = useState(false);
  const [risksDone, setRisksDone] = useState(false);

  // Workspace state
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [showWsDropdown, setShowWsDropdown] = useState(false);

  // Load workspace list on mount
  useEffect(() => {
    const loadWorkspaces = async () => {
      try {
        const res = await workspaceApi.list();
        let list = res.workspaces || [];

        // Keep the graph usable on first load by ensuring one workspace exists.
        if (list.length === 0) {
          const created = await workspaceApi.create({ name: "Default Workspace" });
          list = [created.workspace];
        }

        setWorkspaces(list);
        if (list.length > 0 && !activeWorkspaceId) {
          const saved = localStorage.getItem("activeWorkspaceId");
          const chosen = list.find((w) => w._id === saved)?._id || list[0]._id;
          setActiveWorkspaceId(chosen);
          localStorage.setItem("activeWorkspaceId", chosen);
        }
      } catch (err) {
        console.error("Failed to load workspaces", err);
      }
    };
    loadWorkspaces();
  }, []);

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);

  const switchWorkspace = (id) => {
    setActiveWorkspaceId(id);
    localStorage.setItem("activeWorkspaceId", id);
    setSelectedNode(null);
    setRefreshToken((prev) => prev + 1);
    setShowWsDropdown(false);
  };

  const handleSaveNode = async (id, formData) => {
    setIsSaving(true);
    try {
      await graphApi.updateNode(id, formData);
      setSelectedNode((prev) =>
        prev && prev.id === id
          ? { ...prev, data: { ...prev.data, ...formData } }
          : prev
      );
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to update node", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNode = async (id) => {
    try {
      await graphApi.deleteNode(id);
      setSelectedNode(null);
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to delete node", error);
    }
  };

  const handleLoadDemo = async () => {
    try {
      const res = await graphApi.loadDemo(activeWorkspaceId);
      // If no workspace existed, loadDemo may have created one
      if (res.workspace && !activeWorkspaceId) {
        setActiveWorkspaceId(res.workspace);
      }
      // Refresh workspace list to get updated counts
      const wsList = await workspaceApi.list();
      setWorkspaces(wsList.workspaces || []);
      if (!activeWorkspaceId && res.workspace) {
        setActiveWorkspaceId(res.workspace);
      }
      setSelectedNode(null);
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to load demo graph", error);
    }
  };

  const handleCreateWorkspace = async () => {
    const name = window.prompt("Enter a name for the new workspace:", "New Workspace");
    if (!name || !name.trim()) return;

    try {
      const res = await workspaceApi.create({ name: name.trim() });
      const newWs = res.workspace;
      setWorkspaces((prev) => [...prev, newWs]);
      setActiveWorkspaceId(newWs._id);
      localStorage.setItem("activeWorkspaceId", newWs._id);
      setSelectedNode(null);
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to create new workspace", error);
    }
  };

  const handleDeleteWorkspace = async (id) => {
    if (!window.confirm("Delete this workspace and all its nodes/edges?")) return;
    try {
      await workspaceApi.delete(id);
      setWorkspaces((prev) => prev.filter((w) => w._id !== id));
      if (activeWorkspaceId === id) {
        const remaining = workspaces.filter((w) => w._id !== id);
        setActiveWorkspaceId(remaining.length > 0 ? remaining[0]._id : null);
        setSelectedNode(null);
        setRefreshToken((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Failed to delete workspace", error);
    }
  };

  const handleComputeRisks = async () => {
    setIsComputingRisks(true);
    setRisksDone(false);
    try {
      await graphApi.computeRisks(activeWorkspaceId);
      setSelectedNode(null);
      setRefreshToken((prev) => prev + 1);
      setRisksDone(true);
      setTimeout(() => setRisksDone(false), 3000);
    } catch (error) {
      console.error("Failed to compute risks", error);
    } finally {
      setIsComputingRisks(false);
    }
  };

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col">
        {/* Top bar */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#b1b2ff]/10 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 text-left"
              onClick={() => setShowWsDropdown((prev) => !prev)}
            >
              <h1 className="text-lg font-bold text-slate-900">Graph Builder</h1>
              <p className="text-xs text-slate-500">
                {activeWorkspace ? activeWorkspace.name : "No workspace"}
              </p>
              <span className="material-symbols-outlined text-sm text-slate-400">
                expand_more
              </span>
            </button>

            {showWsDropdown && (
              <div className="absolute top-full left-0 z-50 mt-1 w-[88vw] max-w-sm rounded-xl border border-[#b1b2ff]/20 bg-white shadow-2xl">
                <div className="max-h-60 overflow-y-auto p-2">
                  {workspaces.length === 0 && (
                    <p className="px-3 py-2 text-xs text-slate-400">
                      No workspaces yet
                    </p>
                  )}
                  {workspaces.map((ws) => (
                    <div
                      key={ws._id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-[#b1b2ff]/5 ${
                        ws._id === activeWorkspaceId
                          ? "bg-[#b1b2ff]/10 font-bold text-[#6d6fd8]"
                          : "text-slate-700"
                      }`}
                    >
                      <span
                        className="flex-1 truncate"
                        onClick={() => switchWorkspace(ws._id)}
                      >
                        {ws.name}
                        <span className="ml-2 text-[10px] text-slate-400">
                          {ws.nodeCount ?? 0}N / {ws.edgeCount ?? 0}E
                        </span>
                      </span>
                      <button
                        type="button"
                        className="ml-2 text-slate-300 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWorkspace(ws._id);
                        }}
                        title="Delete workspace"
                      >
                        <span className="material-symbols-outlined text-base">
                          delete
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#b1b2ff]/10 p-2">
                  <button
                    type="button"
                    className="w-full rounded-lg px-3 py-2 text-xs font-bold text-[#6d6fd8] hover:bg-[#b1b2ff]/5"
                    onClick={() => {
                      setShowWsDropdown(false);
                      handleCreateWorkspace();
                    }}
                  >
                    + New Workspace
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            <button
              type="button"
              disabled={isComputingRisks}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition-all ${
                risksDone
                  ? "border-green-200 bg-green-50 text-green-700"
                  : isComputingRisks
                    ? "border-orange-200 bg-orange-50 text-orange-400 opacity-80 cursor-not-allowed"
                    : "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
              onClick={handleComputeRisks}
              title="Recalculate risk scores using external disruptions + live weather"
            >
              {isComputingRisks ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                  Computing…
                </>
              ) : risksDone ? (
                <>
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Done!
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">shield</span>
                  Compute Risks
                </>
              )}
            </button>
            <button
              type="button"
              className="rounded-xl border border-[#b1b2ff]/30 bg-white px-3 py-2 text-xs font-bold text-[#6d6fd8] hover:bg-[#b1b2ff]/5 sm:px-4"
              onClick={handleCreateWorkspace}
            >
              New Workspace
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#b1b2ff] px-3 py-2 text-xs font-bold text-white hover:bg-[#9798f0] sm:px-4"
              onClick={handleLoadDemo}
            >
              Load Demo
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <NodeSidebar open={libraryOpen} onToggle={() => setLibraryOpen((p) => !p)} />

          <section className="graph-grid min-h-0 flex-1">
            <GraphCanvas
              onNodeSelect={setSelectedNode}
              refreshToken={refreshToken}
              setRefreshToken={setRefreshToken}
              workspaceId={activeWorkspaceId}
            />
          </section>

          <NodeDetailsPanel
            key={selectedNode?.id || "no-node-selected"}
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onSave={handleSaveNode}
            onDelete={handleDeleteNode}
            isSaving={isSaving}
            workspaceId={activeWorkspaceId}
            onNetworkChange={() => setRefreshToken((prev) => prev + 1)}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default GraphBuilderPage;
