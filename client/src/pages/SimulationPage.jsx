import { useEffect, useState, useMemo } from "react";
import { Background, Controls, ReactFlow } from "@xyflow/react";
import CustomNode from "../components/CustomNode";
import { analyticsApi, graphApi, workspaceApi } from "../services/api";

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

function normalizeSimulationError(error) {
  const detail = error?.response?.data?.detail;

  if (Array.isArray(detail)) {
    return detail
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object") {
          const loc = Array.isArray(entry.loc) ? entry.loc.join(".") : "field";
          const msg = entry.msg || "Invalid input";
          return `${loc}: ${msg}`;
        }
        return String(entry);
      })
      .join("; ");
  }

  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }

  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  return error?.message || "Failed to run simulation";
}

function getRiskBand(risk) {
  if (risk >= 70) return "high";
  if (risk >= 40) return "moderate";
  return "low";
}

function getRiskBandClasses(risk) {
  const band = getRiskBand(risk);
  if (band === "high") return "bg-red-100 text-red-700";
  if (band === "moderate") return "bg-amber-100 text-amber-700";
  return "bg-green-100 text-green-700";
}

function SimulationPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [loadingWorkspaceGraph, setLoadingWorkspaceGraph] = useState(false);
  const [selectedDisruptions, setSelectedDisruptions] = useState([]);
  const [targetNodeId, setTargetNodeId] = useState("");
  const [disruptionSeverities, setDisruptionSeverities] = useState({});
  const [duration, setDuration] = useState(7);
  const [simResult, setSimResult] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simError, setSimError] = useState("");

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

  const toggleDisruption = (disruptionId) => {
    setSelectedDisruptions((current) => {
      const isSelected = current.includes(disruptionId);
      if (isSelected) {
        setDisruptionSeverities((prev) => {
          const next = { ...prev };
          delete next[disruptionId];
          return next;
        });
        return current.filter((id) => id !== disruptionId);
      }

      setDisruptionSeverities((prev) => ({ ...prev, [disruptionId]: prev[disruptionId] ?? 50 }));
      return [...current, disruptionId];
    });
  };

  const getDisruptionSeverity = (disruptionId) => Number(disruptionSeverities[disruptionId] ?? 50);

  const setDisruptionSeverity = (disruptionId, value) => {
    setDisruptionSeverities((prev) => ({ ...prev, [disruptionId]: value }));
  };

  // Build simulated graph nodes with risk overlay + selection highlight
  const displayNodes = useMemo(() => {
    const impactMap = {};
    if (simResult?.affectedNodes) {
      for (const an of simResult.affectedNodes) {
        impactMap[an.id] = an;
      }
    }

    return nodes.map((n) => {
      const impact = impactMap[n.id];
      const isSelected = n.id === targetNodeId;

      let borderColor = "";
      let bgGlow = "";
      if (impact) {
        if (impact.delta > 20) {
          borderColor = "#f97316";
          bgGlow = "0 0 14px rgba(249,115,22,0.4)";
        } else if (impact.delta > 10) {
          borderColor = "#eab308";
          bgGlow = "0 0 10px rgba(234,179,8,0.3)";
        } else if (impact.delta > 0) {
          borderColor = "#84cc16";
          bgGlow = "";
        }
      }

      if (isSelected && !borderColor) {
        borderColor = "#6d6fd8";
        bgGlow = "0 0 16px rgba(109,111,216,0.45)";
      }

      // Highlight target node in red
      if (isSelected && simResult) {
        borderColor = "#ef4444";
        bgGlow = "0 0 20px rgba(239,68,68,0.5)";
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
    if (!selectedDisruptions.length || !targetNodeId) return;

    setSimRunning(true);
    setSimResult(null);
    setSimError("");

    try {
      const nodeById = new Map();
      const adjacency = new Map();

      nodes.forEach((node) => {
        const nodeId = String(node.id || node.node_id || node._id || "");
        if (!nodeId) return;
        nodeById.set(nodeId, node);
        adjacency.set(nodeId, []);
      });

      edges.forEach((edge) => {
        const sourceId = String(edge.source || edge.sourceId || "");
        const targetId = String(edge.target || edge.targetId || "");
        if (!sourceId || !targetId || !adjacency.has(sourceId)) return;
        adjacency.get(sourceId).push(targetId);
      });

      const payloadNodes = Array.from(nodeById.entries()).map(([nodeId, node]) => {
        const nodeData = node.data || {};
        const nodeEdges = (nodeData.edges || adjacency.get(nodeId) || []).map((id) => String(id));

        return {
          node_id: nodeId,
          edges: nodeEdges,
          name: nodeData.name,
          type: nodeData.type,
          label: nodeData.label,
          title: nodeData.title,
          product: nodeData.product,
          product_name: nodeData.product_name,
          product_id: nodeData.product_id,
          sku: nodeData.sku,
          sku_id: nodeData.sku_id,
          drug_name: nodeData.drug_name,
          medicine: nodeData.medicine,
          material: nodeData.material,
          material_name: nodeData.material_name,
          financial_health_score: nodeData.financial_health_score,
          historical_delay_frequency_pct: nodeData.historical_delay_frequency_pct,
          batch_failure_rate_pct: nodeData.batch_failure_rate_pct,
          lead_time_volatility_days: nodeData.lead_time_volatility_days,
          dependency_pct: nodeData.dependency_pct,
          dependency_percentage: nodeData.dependency_percentage,
          capacity_utilization_pct: nodeData.capacity_utilization_pct,
          capacity_utilization: nodeData.capacity_utilization,
          gmp_status: nodeData.gmp_status,
          fda_approved: nodeData.fda_approved,
          active_disruption_signal: nodeData.active_disruption_signal,
          compliance_violation_flag: nodeData.compliance_violation_flag,
          compliance_status: nodeData.compliance_status,
        };
      });

      const payload = {
        origin_node_id: targetNodeId,
        disruption_type: selectedDisruptions[0],
        severity: Number(
          (
            Math.max(...selectedDisruptions.map((disruptionType) => getDisruptionSeverity(disruptionType))) /
            10
          ).toFixed(2)
        ),
        max_hops: 4,
        risk_threshold: 20,
        disruptions: selectedDisruptions.map((disruptionType) => ({
          disruption_type: disruptionType,
          severity: Number((getDisruptionSeverity(disruptionType) / 10).toFixed(2)),
        })),
        nodes: payloadNodes,
      };

      const response = await analyticsApi.simulate(payload);
      const targetNode = nodeById.get(targetNodeId);

      const originalRiskMap = new Map(
        nodes.map((node) => [
          String(node.id || node.node_id || node._id || ""),
          Number(node.data?.risk_score || 0),
        ])
      );

      const affectedNodes = (response.affected_nodes || [])
        .map((item) => {
          const srcNode = nodeById.get(item.node_id);
          const originalRisk = originalRiskMap.get(item.node_id) || 0;
          const simulatedRisk = Number(item.risk_score || 0);

          return {
            id: item.node_id,
            name: srcNode?.data?.name || item.node_id,
            type: srcNode?.data?.type || "Unknown",
            originalRisk,
            simulatedRisk,
            delta: Number((simulatedRisk - originalRisk).toFixed(2)),
            hop: item.hop,
          };
        })
        .sort((a, b) => b.delta - a.delta);

      const originOriginalRisk = Number(targetNode?.data?.risk_score || 0);
      const baselineTotal = nodes.reduce(
        (sum, node) => sum + Number(node.data?.risk_score || 0),
        0
      );
      const avgOriginal = nodes.length ? Math.round(baselineTotal / nodes.length) : 0;

      const simulatedRiskById = new Map(
        nodes.map((node) => [
          String(node.id || node.node_id || node._id || ""),
          Number(node.data?.risk_score || 0),
        ])
      );
      simulatedRiskById.set(targetNodeId, Number(response.origin_risk || 0));
      affectedNodes.forEach((node) => simulatedRiskById.set(node.id, node.simulatedRisk));

      const simulatedTotal = Array.from(simulatedRiskById.values()).reduce(
        (sum, riskValue) => sum + riskValue,
        0
      );
      const avgSimulated = nodes.length ? Math.round(simulatedTotal / nodes.length) : 0;
      const maxSelectedSeverity = selectedDisruptions.length
        ? Math.max(...selectedDisruptions.map((disruptionType) => getDisruptionSeverity(disruptionType)))
        : 50;

      setSimResult({
        disruptions: DISRUPTION_TYPES.filter((d) => selectedDisruptions.includes(d.id)),
        primaryDisruption: DISRUPTION_TYPES.find((d) => d.id === selectedDisruptions[0]),
        targetNode: targetNode?.data,
        disruptionSeverities: Object.fromEntries(
          selectedDisruptions.map((id) => [id, getDisruptionSeverity(id)])
        ),
        duration,
        impactedNodeCount: Number(response.total_affected || 0) + 1,
        avgOriginal,
        avgSimulated,
        affectedNodes: affectedNodes.slice(0, 10),
        overallImpact: Math.max(0, avgSimulated - avgOriginal),
        recoveryEstimate: Math.round(duration * (1 + maxSelectedSeverity / 100)),
        originRiskDelta: Number((Number(response.origin_risk || 0) - originOriginalRisk).toFixed(2)),
        model: response.model,
        affectedProducts: response.affected_products || [],
        impactTimeline: response.impact_timeline || [],
        rippleByHop: response.ripple_by_hop || [],
      });
    } catch (error) {
      console.error("Simulation request failed", error);
      setSimError(normalizeSimulationError(error));
      setSimResult(null);
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
            setSelectedDisruptions([]);
            setDisruptionSeverities({});
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

          {/* Disruption type (multi-select) */}
          <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">Disruption Type</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            {DISRUPTION_TYPES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                  selectedDisruptions.includes(d.id)
                    ? "border-[#b1b2ff] bg-[#b1b2ff]/10 text-[#b1b2ff]"
                    : "border-slate-100 text-slate-500 hover:border-[#b1b2ff]/30"
                }`}
                onClick={() => toggleDisruption(d.id)}
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

          {/* Severity by Disruption */}
          <div className="mb-5 block">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400">Severity by Disruption</span>
            </div>
            {selectedDisruptions.length ? (
              <div className="space-y-3">
                {selectedDisruptions.map((id) => {
                  const disruption = DISRUPTION_TYPES.find((item) => item.id === id);
                  const currentSeverity = getDisruptionSeverity(id);
                  return (
                    <div key={`sev-${id}`} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">{disruption?.label || id}</span>
                        <span className="text-xs font-bold text-[#b1b2ff]">{currentSeverity}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={currentSeverity}
                        onChange={(e) => setDisruptionSeverity(id, Number(e.target.value))}
                        className="mt-1 w-full accent-[#b1b2ff]"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Select one or more disruptions to configure severities.</p>
            )}
          </div>

          {/* Duration */}
          <label className="mb-6 block">
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

          <button
            type="button"
            disabled={!selectedDisruptions.length || !targetNodeId || simRunning}
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
          {simError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {simError}
            </div>
          )}

          {simRunning && (
            <div className="flex flex-col items-center justify-center py-8">
              <span className="material-symbols-outlined animate-spin text-5xl text-[#b1b2ff]">progress_activity</span>
              <p className="mt-4 text-sm font-semibold text-slate-600">Running simulation model...</p>
            </div>
          )}

          {simResult && (
            <div className="flex flex-col gap-6">
              {/* Impact summary cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Nodes Impacted</p>
                  <p className="text-3xl font-black text-slate-900">{simResult.impactedNodeCount}</p>
                  <p className="text-[10px] text-slate-400">of {nodes.length} total</p>
                </div>
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Risk Shift</p>
                  <p className="text-3xl font-black text-red-600">
                    {simResult.avgOriginal}% → {simResult.avgSimulated}%
                  </p>
                  <p className="text-[10px] text-slate-400">
                    +{simResult.avgSimulated - simResult.avgOriginal}% average increase
                  </p>
                </div>
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Est. Recovery</p>
                  <p className="text-3xl font-black text-slate-900">{simResult.recoveryEstimate}d</p>
                  <p className="text-[10px] text-slate-400">to return to baseline</p>
                </div>
              </div>

              {/* Scenario detail card */}
              <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    <span className="material-symbols-outlined">{simResult.primaryDisruption?.icon || "science"}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {(simResult.disruptions || []).map((d) => d.label).join(" + ") || "Scenario"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Target: {simResult.targetNode?.name} · Duration: {simResult.duration}d
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Severities: {(simResult.disruptions || [])
                        .map((d) => `${d.label} ${simResult.disruptionSeverities?.[d.id] || 50}%`)
                        .join(" · ")}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Affected Products</p>
                  {simResult.affectedProducts?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {simResult.affectedProducts.slice(0, 12).map((product) => (
                        <span
                          key={product}
                          className="rounded-full border border-[#b1b2ff]/20 bg-[#b1b2ff]/10 px-3 py-1 text-[11px] font-medium text-[#6d6fd8]"
                        >
                          {product}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No explicit product labels on impacted nodes.</p>
                  )}
                </div>
              </div>

              {/* Impact Timeline + Ripple by Hop */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Impact Timeline</h3>
                  <div className="space-y-3">
                    {(simResult.impactTimeline || []).map((step) => (
                      <div key={`timeline-${step.hop}-${step.day}`} className="rounded-xl border border-slate-100 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700">Day {step.day} · {step.stage}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">Hop {step.hop}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${getRiskBandClasses(step.avg_risk)}`}
                            >
                              {getRiskBand(step.avg_risk)}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Nodes: {step.affected_nodes} · Cumulative: {step.cumulative_affected} · Avg Risk: {step.avg_risk}% · Peak Risk: {step.peak_risk}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Ripple by Hop</h3>
                  <div className="space-y-3">
                    {(simResult.rippleByHop || []).map((hop) => (
                      <div key={`hop-${hop.hop}`}>
                        <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                          <span className="font-semibold">Hop {hop.hop}</span>
                          <span>{hop.nodes} nodes · Avg Risk {hop.avg_risk}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-[#b1b2ff]"
                            style={{ width: `${Math.min(100, Math.max(4, hop.avg_risk))}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500">Peak Risk {hop.peak_risk}% · Avg Lead-time +{hop.avg_lead_time_increase}d</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cascading impact table */}
              <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Cascading Impact ({simResult.affectedNodes.length} most affected)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <th className="pb-3 pr-4">Node</th>
                        <th className="pb-3 pr-4">Type</th>
                        <th className="pb-3 pr-4">Original Risk</th>
                        <th className="pb-3 pr-4">Simulated Risk</th>
                        <th className="pb-3">Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {simResult.affectedNodes.map((n) => (
                        <tr key={n.id} className="text-slate-700">
                          <td className="py-3 pr-4 font-medium">{n.name}</td>
                          <td className="py-3 pr-4">
                            <span className="rounded bg-[#b1b2ff]/10 px-2 py-0.5 text-[10px] font-medium text-[#6d6fd8]">{n.type}</span>
                          </td>
                          <td className="py-3 pr-4 text-xs">{n.originalRisk}%</td>
                          <td className="py-3 pr-4 text-xs font-bold text-red-600">{n.simulatedRisk}%</td>
                          <td className="py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              n.delta > 20 ? "bg-red-100 text-red-700" : n.delta > 10 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                            }`}>
                              +{n.delta}%
                            </span>
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
