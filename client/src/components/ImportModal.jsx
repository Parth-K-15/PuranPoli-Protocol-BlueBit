import { useCallback, useEffect, useState } from "react";
import { workspaceApi, graphApi } from "../services/api";
import { NODE_META } from "../constants/nodeMeta";

function ImportModal({
  sourceWorkspaceId,
  sourceWorkspaceName,
  sourceNodes = [],
  sourceEdges = [],
  onClose,
  onImportSuccess,
}) {
  // Step tracking
  const [step, setStep] = useState(1); // 1=target ws, 2=anchor node, 3=entry node

  // Target workspace
  const [workspaces, setWorkspaces] = useState([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [targetWsId, setTargetWsId] = useState(null);

  // Anchor node (in target workspace)
  const [targetNodes, setTargetNodes] = useState([]);
  const [loadingTargetGraph, setLoadingTargetGraph] = useState(false);
  const [anchorNodeId, setAnchorNodeId] = useState(null);

  // Entry node (in source chain)
  const [entryNodeId, setEntryNodeId] = useState(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Load user workspaces on mount
  useEffect(() => {
    const load = async () => {
      try {
        const res = await workspaceApi.list();
        setWorkspaces(res.workspaces || []);
      } catch (err) {
        console.error("Failed to load workspaces", err);
      } finally {
        setLoadingWorkspaces(false);
      }
    };
    load();
  }, []);

  // Load target workspace graph when target is selected
  useEffect(() => {
    if (!targetWsId) {
      setTargetNodes([]);
      return;
    }

    const load = async () => {
      setLoadingTargetGraph(true);
      try {
        const res = await graphApi.getGraph(targetWsId);
        setTargetNodes(res.nodes || []);
      } catch (err) {
        console.error("Failed to load target graph", err);
        setTargetNodes([]);
      } finally {
        setLoadingTargetGraph(false);
      }
    };
    load();
  }, [targetWsId]);

  const handleImport = useCallback(async () => {
    if (!targetWsId || !anchorNodeId || !entryNodeId) return;

    setImporting(true);
    setImportError(null);

    try {
      await workspaceApi.importChain(targetWsId, {
        sourceWorkspaceId,
        anchorNodeId,
        entryNodeId,
      });
      setImportSuccess(true);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      console.error("Import failed", err);
      setImportError(
        err?.response?.data?.message || err.message || "Import failed. Please try again."
      );
    } finally {
      setImporting(false);
    }
  }, [targetWsId, anchorNodeId, entryNodeId, sourceWorkspaceId, onImportSuccess]);

  const getNodeIcon = (type) => {
    const meta = NODE_META[type];
    return meta ? meta.icon : "hub";
  };

  const getNodeIconClass = (type) => {
    const meta = NODE_META[type];
    return meta ? meta.iconClass : "bg-slate-200 text-slate-700";
  };

  // Success screen
  if (importSuccess) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="mx-4 w-full max-w-md rounded-2xl border border-[#b1b2ff]/10 bg-white p-8 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <span className="material-symbols-outlined text-3xl text-emerald-600">
                check_circle
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Import Successful</h2>
            <p className="text-sm text-slate-500">
              The supply chain from <span className="font-semibold text-[#6d6fd8]">{sourceWorkspaceName}</span> has
              been imported into your workspace.
            </p>
            <button
              type="button"
              className="mt-2 rounded-xl bg-[#b1b2ff] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#9798f0] transition-colors"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 flex w-full max-w-lg flex-col rounded-2xl border border-[#b1b2ff]/10 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Import Supply Chain</h2>
            <p className="text-xs text-slate-500">
              From <span className="font-semibold text-[#6d6fd8]">{sourceWorkspaceName}</span>
            </p>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 border-b border-slate-50 px-6 py-3">
          {[
            { num: 1, label: "Target Workspace" },
            { num: 2, label: "Anchor Node" },
            { num: 3, label: "Entry Node" },
          ].map(({ num, label }) => (
            <div key={num} className="flex items-center gap-2">
              {num > 1 && <div className="h-px w-4 bg-slate-200" />}
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  step === num
                    ? "bg-[#6d6fd8] text-white"
                    : step > num
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                {step > num ? (
                  <span className="material-symbols-outlined text-[12px]">check</span>
                ) : (
                  num
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  step === num ? "text-[#6d6fd8]" : "text-slate-400"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="max-h-[50vh] overflow-y-auto px-6 py-4">
          {/* Step 1: Select target workspace */}
          {step === 1 && (
            <div>
              <p className="mb-3 text-xs text-slate-500">
                Select the workspace where you want to import this supply chain.
              </p>
              {loadingWorkspaces ? (
                <div className="flex items-center justify-center py-8">
                  <span className="material-symbols-outlined animate-spin text-2xl text-[#b1b2ff]">
                    progress_activity
                  </span>
                </div>
              ) : workspaces.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No workspaces found. Create one first in Graph Builder.
                </p>
              ) : (
                <div className="space-y-2">
                  {workspaces.map((ws) => (
                    <button
                      key={ws._id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        targetWsId === ws._id
                          ? "border-[#6d6fd8] bg-[#b1b2ff]/5 ring-2 ring-[#a390f9]/30"
                          : "border-slate-100 hover:border-[#b1b2ff]/30 hover:bg-slate-50"
                      }`}
                      onClick={() => setTargetWsId(ws._id)}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          targetWsId === ws._id
                            ? "bg-[#6d6fd8] text-white"
                            : "bg-[#b1b2ff]/10 text-[#6d6fd8]"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {targetWsId === ws._id ? "radio_button_checked" : "radio_button_unchecked"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">{ws.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {ws.nodeCount ?? 0} nodes / {ws.edgeCount ?? 0} edges
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select anchor node in target workspace */}
          {step === 2 && (
            <div>
              <p className="mb-3 text-xs text-slate-500">
                Select the node in your workspace where the imported chain will be attached.
              </p>
              {loadingTargetGraph ? (
                <div className="flex items-center justify-center py-8">
                  <span className="material-symbols-outlined animate-spin text-2xl text-[#b1b2ff]">
                    progress_activity
                  </span>
                </div>
              ) : targetNodes.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No nodes in this workspace. Choose a different workspace or add nodes first.
                </p>
              ) : (
                <div className="space-y-2">
                  {targetNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        anchorNodeId === node.id
                          ? "border-[#6d6fd8] bg-[#b1b2ff]/5 ring-2 ring-[#a390f9]/30"
                          : "border-slate-100 hover:border-[#b1b2ff]/30 hover:bg-slate-50"
                      }`}
                      onClick={() => setAnchorNodeId(node.id)}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          anchorNodeId === node.id
                            ? "bg-[#6d6fd8] text-white"
                            : getNodeIconClass(node.data?.type)
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {anchorNodeId === node.id
                            ? "radio_button_checked"
                            : getNodeIcon(node.data?.type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                          {node.data?.name || node.id}
                        </p>
                        <p className="text-[10px] text-slate-400">{node.data?.type || "Unknown"}</p>
                      </div>
                      {node.data?.country && (
                        <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          {node.data.country}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Select entry node from source chain */}
          {step === 3 && (
            <div>
              <p className="mb-3 text-xs text-slate-500">
                Select the entry node from the source chain that will connect to your anchor node.
              </p>
              {sourceNodes.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No nodes available in the source chain.
                </p>
              ) : (
                <div className="space-y-2">
                  {sourceNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                        entryNodeId === node.id
                          ? "border-[#6d6fd8] bg-[#b1b2ff]/5 ring-2 ring-[#a390f9]/30"
                          : "border-slate-100 hover:border-[#b1b2ff]/30 hover:bg-slate-50"
                      }`}
                      onClick={() => setEntryNodeId(node.id)}
                    >
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          entryNodeId === node.id
                            ? "bg-[#6d6fd8] text-white"
                            : getNodeIconClass(node.data?.type)
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {entryNodeId === node.id
                            ? "radio_button_checked"
                            : getNodeIcon(node.data?.type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                          {node.data?.name || node.id}
                        </p>
                        <p className="text-[10px] text-slate-400">{node.data?.type || "Unknown"}</p>
                      </div>
                      {node.data?.country && (
                        <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                          {node.data.country}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error message */}
          {importError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
              {importError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
            onClick={() => {
              if (step === 1) onClose();
              else setStep((s) => s - 1);
            }}
          >
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              className="rounded-xl bg-[#6d6fd8] px-5 py-2 text-xs font-bold text-white hover:bg-[#5b5dc0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={
                (step === 1 && !targetWsId) ||
                (step === 2 && !anchorNodeId)
              }
              onClick={() => setStep((s) => s + 1)}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl bg-[#6d6fd8] px-5 py-2 text-xs font-bold text-white hover:bg-[#5b5dc0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!entryNodeId || importing}
              onClick={handleImport}
            >
              {importing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[14px]">
                    progress_activity
                  </span>
                  Importing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Import
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImportModal;
