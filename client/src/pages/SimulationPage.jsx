import { useEffect, useState, useMemo } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import CustomNode from "../components/CustomNode";
import { graphApi, workspaceApi, simulationApi } from "../services/api";

const DISRUPTION_TYPES = [
  { id: "supplier_failure", label: "Supplier Failure", icon: "error", desc: "A key supplier goes offline" },
  { id: "transport_delay", label: "Transport Delay", icon: "local_shipping", desc: "Logistics disruption on a route" },
  { id: "demand_surge", label: "Demand Surge", icon: "trending_up", desc: "Sudden increase in demand" },
  { id: "natural_disaster", label: "Natural Disaster", icon: "flood", desc: "Regional catastrophe impacting facilities" },
  { id: "quality_issue", label: "Quality Issue", icon: "gpp_bad", desc: "Batch recall or quality failure" },
  { id: "regulatory_change", label: "Regulatory Change", icon: "gavel", desc: "New compliance requirements" },
];

const simulationNodeTypes = {
  supplyNode: CustomNode,
};

function SimulationPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingWorkspaceGraph, setLoadingWorkspaceGraph] = useState(false);
  const [selectedDisruption, setSelectedDisruption] = useState(null);
  const [targetNodeId, setTargetNodeId] = useState("");
  const [severity, setSeverity] = useState(50);
  const [duration, setDuration] = useState(7);
  const [revenuePerDay, setRevenuePerDay] = useState(0);
  const [simResult, setSimResult] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simError, setSimError] = useState(null);

  useEffect(() => {
    async function loadWorkspaces() {
      try {
        const res = await workspaceApi.list();
        setWorkspaces(res.workspaces || []);
      } catch (error) {
        console.error("Failed to load workspaces", error);
      } finally {
        setLoadingWorkspaces(false);
      }
    }

    loadWorkspaces();
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    async function loadWorkspaceGraph() {
      setLoadingWorkspaceGraph(true);
      setTargetNodeId("");
      setSimResult(null);

      try {
        const data = await graphApi.getGraph(activeWorkspaceId);
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (error) {
        console.error("Failed to load workspace graph", error);
        setNodes([]);
        setEdges([]);
      } finally {
        setLoadingWorkspaceGraph(false);
      }
    }

    loadWorkspaceGraph();
  }, [activeWorkspaceId]);

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);

  // Build simulated graph nodes with risk overlay + selection highlight
  const displayNodes = useMemo(() => {
    const impactMap = {};
    if (simResult?.affected_nodes) {
      for (const an of simResult.affected_nodes) {
        impactMap[an.id] = an;
      }
    }

    return nodes.map((n) => {
      const impact = impactMap[n.id];
      const isSelected = n.id === targetNodeId;

      // Compute overlay color based on delta
      let borderColor = "";
      let bgGlow = "";
      if (impact) {
        if (impact.is_target) {
          borderColor = "#ef4444"; // red-500
          bgGlow = "0 0 20px rgba(239,68,68,0.5)";
        } else if (impact.delta > 20) {
          borderColor = "#f97316"; // orange-500
          bgGlow = "0 0 14px rgba(249,115,22,0.4)";
        } else if (impact.delta > 10) {
          borderColor = "#eab308"; // yellow-500
          bgGlow = "0 0 10px rgba(234,179,8,0.3)";
        } else if (impact.delta > 0) {
          borderColor = "#84cc16"; // lime-500
          bgGlow = "";
        }
      }

      // Selected node highlight (when no sim result or not already colored)
      if (isSelected && !borderColor) {
        borderColor = "#6d6fd8";
        bgGlow = "0 0 16px rgba(109,111,216,0.45)";
      }

      return {
        ...n,
        selected: isSelected,
        style: {
          ...n.style,
          ...(borderColor
            ? {
                border: `2.5px solid ${borderColor}`,
                boxShadow: bgGlow,
                borderRadius: "12px",
                transition: "all 0.35s ease",
              }
            : {}),
        },
      };
    });
  }, [nodes, simResult, targetNodeId]);

  const runSimulation = async () => {
    if (!selectedDisruption || !targetNodeId) return;

    setSimRunning(true);
    setSimResult(null);
    setSimError(null);

    try {
      const result = await simulationApi.run({
        disruption_type: selectedDisruption,
        target_node_id: targetNodeId,
        severity,
        duration_days: duration,
        revenue_per_day: revenuePerDay || 0,
        workspace: activeWorkspaceId || undefined,
      });

      setSimResult(result);
    } catch (error) {
      console.error("Simulation failed:", error);
      setSimError(
        error.response?.data?.detail || error.response?.data?.error || error.message || "Simulation request failed"
      );
    } finally {
      setSimRunning(false);
    }
  };

  if (loadingWorkspaces) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#b1b2ff]">progress_activity</span>
      </div>
    );
  }

  if (!activeWorkspaceId) {
    return (
      <div className="flex flex-col gap-8 p-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scenario Simulation</h1>
          <p className="text-sm text-slate-500">Select a workspace to open simulation lab</p>
        </div>

        <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Workspaces</h3>

          {workspaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              No workspaces found. Create one in Graph Builder first.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {workspaces.map((workspace) => (
                <button
                  key={workspace._id}
                  type="button"
                  onClick={() => setActiveWorkspaceId(workspace._id)}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-[#b1b2ff]/40 hover:bg-[#b1b2ff]/5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{workspace.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {workspace.nodeCount || 0} nodes · {workspace.edgeCount || 0} links
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#6d6fd8]">Open</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loadingWorkspaceGraph) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#b1b2ff]">progress_activity</span>
      </div>
    );
  }

  const summary = simResult?.summary;
  const financial = simResult?.financial_impact;
  const disruption = DISRUPTION_TYPES.find((d) => d.id === simResult?.disruption_type);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#b1b2ff]/10 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Scenario Simulation</h1>
          <p className="text-xs text-slate-500">
            {activeWorkspace?.name || "Selected workspace"} · Click a node on the graph to target it
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveWorkspaceId("");
            setNodes([]);
            setEdges([]);
            setTargetNodeId("");
            setSimResult(null);
            setSelectedDisruption(null);
          }}
          className="rounded-xl border border-[#b1b2ff]/20 bg-white px-4 py-2 text-xs font-bold text-[#6d6fd8] hover:bg-[#b1b2ff]/5"
        >
          Change Workspace
        </button>
      </div>

      {/* Side-by-side: Graph + Build Scenario panel */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Graph canvas — fills remaining space */}
        <section className="relative min-h-0 flex-1">
          {simResult && (
            <div className="absolute left-4 top-3 z-10 flex items-center gap-3 rounded-xl border border-white/60 bg-white/80 px-3 py-1.5 text-[10px] shadow-sm backdrop-blur-sm">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" /> Target</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500" /> High</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-500" /> Moderate</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-lime-500" /> Low</span>
            </div>
          )}

          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              No nodes found in this workspace.
            </div>
          ) : (
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              nodeTypes={simulationNodeTypes}
              fitView
              minZoom={0.3}
              maxZoom={1.8}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={true}
              onNodeClick={(_event, node) => setTargetNodeId(node.id)}
            >
              <Background gap={40} size={1} color="#b1b2ff33" />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </section>

        {/* Build Scenario — right sidebar */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-[#b1b2ff]/10 bg-white p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Build Scenario</h3>

          {/* Disruption type */}
          <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">Disruption Type</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {DISRUPTION_TYPES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                  selectedDisruption === d.id
                    ? "border-[#b1b2ff] bg-[#b1b2ff]/10 text-[#b1b2ff]"
                    : "border-slate-100 text-slate-500 hover:border-[#b1b2ff]/30"
                }`}
                onClick={() => setSelectedDisruption(d.id)}
              >
                <span className="material-symbols-outlined text-[20px]">{d.icon}</span>
                <span className="text-[10px] font-semibold">{d.label}</span>
              </button>
            ))}
          </div>

          {/* Target node — click-to-select indicator */}
          <div className="mb-5">
            <span className="text-[10px] font-bold uppercase text-slate-400">Target Node</span>
            {targetNodeId ? (() => {
              const targetNode = nodes.find((n) => n.id === targetNodeId);
              return (
                <div className="mt-1 flex items-center gap-2 rounded-xl border border-[#6d6fd8]/30 bg-[#b1b2ff]/5 px-4 py-3">
                  <span className="material-symbols-outlined text-[18px] text-[#6d6fd8]">check_circle</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{targetNode?.data?.name || targetNodeId}</p>
                    <p className="text-[10px] text-slate-400">{targetNode?.data?.type || "Node"}</p>
                  </div>
                  <button
                    type="button"
                    className="text-slate-300 transition-colors hover:text-red-400"
                    onClick={() => setTargetNodeId("")}
                    title="Clear selection"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              );
            })() : (
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                <span className="material-symbols-outlined text-[18px] text-slate-300">ads_click</span>
                <p className="text-xs text-slate-400">Click a node on the graph</p>
              </div>
            )}
          </div>

        {/* Results */}
        <div className="lg:col-span-2">
          {!simResult && !simRunning && (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#b1b2ff]/20 bg-white/50 p-12">
              <span className="material-symbols-outlined mb-4 text-5xl text-[#b1b2ff]/30">science</span>
              <div className="mb-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                Under Development
              </div>
              <h3 className="text-lg font-bold text-slate-700">Configure & Run</h3>
              <p className="mt-1 max-w-sm text-center text-sm text-slate-400">
                Select a disruption type, target node, and severity, then run the simulation to see projected impacts.
              </p>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={severity}
              onChange={(e) => setSeverity(Number(e.target.value))}
              className="mt-2 w-full accent-[#b1b2ff]"
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Minor</span>
              <span>Catastrophic</span>
            </div>
          </label>

          {/* Duration */}
          <label className="mb-5 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">Duration (days)</span>
            <input
              type="number"
              min="1"
              max="365"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-[#b1b2ff]/10 bg-[#b1b2ff]/5 px-4 py-3 text-sm font-medium"
            />
          </label>

          {/* Revenue per day (for financial estimation) */}
          <label className="mb-6 block">
            <span className="text-[10px] font-bold uppercase text-slate-400">Revenue per day (₹) — optional</span>
            <input
              type="number"
              min="0"
              value={revenuePerDay}
              onChange={(e) => setRevenuePerDay(Number(e.target.value))}
              placeholder="e.g. 50000"
              className="mt-1 w-full rounded-xl border border-[#b1b2ff]/10 bg-[#b1b2ff]/5 px-4 py-3 text-sm font-medium"
            />
            <p className="mt-1 text-[10px] text-slate-400">Used to estimate revenue at risk from disruption</p>
          </label>

          <button
            type="button"
            disabled={!selectedDisruption || !targetNodeId || simRunning}
            className="w-full rounded-xl bg-[#b1b2ff] py-3 text-sm font-bold text-white shadow-lg shadow-[#b1b2ff]/20 transition-colors hover:bg-[#9798f0] disabled:opacity-50"
            onClick={runSimulation}
          >
            {simRunning ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Simulating...
              </span>
            ) : (
              "Run Simulation"
            )}
          </button>
        </aside>
      </div>

      {/* Results — below the side-by-side area */}
      {(simResult || simRunning || simError) && (
        <div className="shrink-0 overflow-y-auto border-t border-[#b1b2ff]/10 bg-white p-6">
          {simRunning && (
            <div className="flex flex-col items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-5xl text-[#b1b2ff]">progress_activity</span>
              <p className="mt-4 text-sm font-semibold text-slate-600">Running simulation model...</p>
              <p className="mt-1 text-xs text-slate-400">Performing BFS cascade through supply chain graph</p>
            </div>
          )}

          {simError && (
            <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6">
              <div className="flex items-center gap-2 text-red-700">
                <span className="material-symbols-outlined text-xl">error</span>
                <p className="text-sm font-semibold">Simulation Failed</p>
              </div>
              <p className="mt-2 text-xs text-red-600">{simError}</p>
              <button
                type="button"
                onClick={() => setSimError(null)}
                className="mt-3 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
              >
                Dismiss
              </button>
            </div>
          )}

          {simResult && summary && (
            <div className="flex flex-col gap-6">
              {/* Impact summary cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Nodes Impacted</p>
                  <p className="text-3xl font-black text-slate-900">{summary.total_impacted}</p>
                  <p className="text-[10px] text-slate-400">of {summary.total_nodes} total</p>
                </div>
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Avg Risk Shift</p>
                  <p className="text-3xl font-black text-red-600">+{summary.avg_risk_shift}%</p>
                  <p className="text-[10px] text-slate-400">max: +{summary.max_risk_shift}%</p>
                </div>
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Est. Recovery</p>
                  <p className="text-3xl font-black text-slate-900">{summary.estimated_recovery_days}d</p>
                  <p className="text-[10px] text-slate-400">to return to baseline</p>
                </div>
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Lead Time Impact</p>
                  <p className="text-3xl font-black text-amber-600">+{summary.avg_lead_time_increase}d</p>
                  <p className="text-[10px] text-slate-400">avg increase</p>
                </div>
              </div>

              {/* Plant shutdown + financial alerts */}
              <div className="flex flex-wrap gap-3">
                {summary.plant_shutdown_risk && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
                    <span className="material-symbols-outlined text-red-600 text-[18px]">warning</span>
                    <span className="text-xs font-bold text-red-700">Plant Shutdown Risk Detected</span>
                  </div>
                )}
                {financial?.has_financial_data && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                    <span className="material-symbols-outlined text-amber-600 text-[18px]">payments</span>
                    <span className="text-xs font-bold text-amber-700">
                      Revenue at Risk: ₹{summary.total_revenue_at_risk?.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>

              {/* Scenario detail card */}
              {disruption && (
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                      <span className="material-symbols-outlined">{disruption.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{disruption.label}</p>
                      <p className="text-xs text-slate-500">
                        Target: {simResult.target_node?.name} · Severity: {simResult.severity}% · Duration: {simResult.duration_days}d
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Financial impact breakdown (if revenue provided) */}
              {financial?.has_financial_data && financial.per_node_revenue_impact?.length > 0 && (
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                    Financial Impact Breakdown
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                          <th className="pb-3 pr-4">Node</th>
                          <th className="pb-3 pr-4">Revenue Loss</th>
                          <th className="pb-3 pr-4">From Capacity</th>
                          <th className="pb-3">From Lead Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {financial.per_node_revenue_impact.map((n) => (
                          <tr key={n.node_id} className="text-slate-700">
                            <td className="py-3 pr-4 font-medium">{n.name}</td>
                            <td className="py-3 pr-4 text-xs font-bold text-red-600">₹{n.revenue_loss?.toLocaleString("en-IN")}</td>
                            <td className="py-3 pr-4 text-xs">₹{n.capacity_loss?.toLocaleString("en-IN")}</td>
                            <td className="py-3 text-xs">₹{n.lead_time_loss?.toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cascading impact table */}
              <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Cascading Impact ({simResult.affected_nodes?.length || 0} nodes affected)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="pb-3 pr-4">Node</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4">Hop</th>
                        <th className="pb-3 pr-4">Original Risk</th>
                        <th className="pb-3 pr-4">Simulated Risk</th>
                        <th className="pb-3 pr-4">Delta</th>
                        <th className="pb-3">Lead Time +</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(simResult.affected_nodes || []).slice(0, 20).map((n) => (
                        <tr key={n.id} className={`text-slate-700 ${n.is_target ? "bg-red-50/50" : ""}`}>
                          <td className="py-3 pr-4 font-medium">
                            {n.name}
                            {n.is_target && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                                TARGET
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="rounded bg-[#b1b2ff]/10 px-2 py-0.5 text-[10px] font-medium text-[#6d6fd8]">{n.type}</span>
                          </td>
                          <td className="py-3 pr-4 text-xs text-slate-400">{n.hop}</td>
                          <td className="py-3 pr-4 text-xs">{n.original_risk}%</td>
                          <td className="py-3 pr-4 text-xs font-bold text-red-600">{n.simulated_risk}%</td>
                          <td className="py-3 pr-4">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              n.delta > 20 ? "bg-red-100 text-red-700" : n.delta > 10 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                              +{n.delta}%
                            </span>
                          </td>
                          <td className="py-3 text-xs text-amber-600 font-medium">
                            {n.lead_time_increase > 0 ? `+${n.lead_time_increase}d` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SimulationPage;
