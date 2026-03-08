import { useEffect, useState } from "react";
import { analyticsApi, graphApi } from "../services/api";
import { NODE_META } from "../constants/nodeMeta";
import { workspaceApi } from "../services/api";

function RiskBadge({ score }) {
  if (score <= 30) return <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">Low</span>;
  if (score <= 60) return <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-bold text-yellow-700">Medium</span>;
  if (score <= 80) return <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-bold text-orange-700">High</span>;
  return <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700">Critical</span>;
}

function RiskGauge({ value, size = 120 }) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (value / 100) * circumference;
  const color = value <= 30 ? "#22c55e" : value <= 60 ? "#eab308" : value <= 80 ? "#f97316" : "#ef4444";

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset, transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-2xl font-black text-slate-900">{value}%</span>
      </div>
    </div>
  );
}

export default function RiskAnalysisPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsError, setAnalyticsError] = useState("");
  const [sortBy, setSortBy] = useState("risk_score");
  const [sortDir, setSortDir] = useState("desc");
  const [filterType, setFilterType] = useState("all");
  const [showSpofDetails, setShowSpofDetails] = useState(false);

  const [computing, setComputing] = useState(false);
  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);

  const handleComputeRisks = async () => {
    if (!activeWorkspaceId) return;
    setComputing(true);
    try {
      await graphApi.computeRisks(activeWorkspaceId);
      const graphData = await graphApi.getGraph(activeWorkspaceId);
      setNodes(graphData.nodes || []);
      setEdges(graphData.edges || []);

      const pred = await analyticsApi.predictGraph({
        nodes: graphData.nodes || [],
        edges: graphData.edges || [],
      });
      setAnalytics(pred?.predictions || null);
    } catch (error) {
      console.error("Failed to compute risks", error);
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => {
    async function initWorkspaces() {
      try {
        const res = await workspaceApi.list();
        const list = res.workspaces || [];
        setWorkspaces(list);
        if (list.length === 0) {
          setLoading(false);
          return;
        }
        const saved = localStorage.getItem("activeWorkspaceId");
        const chosen = list.find((w) => w._id === saved)?._id || list[0]._id;
        setActiveWorkspaceId(chosen);
        localStorage.setItem("activeWorkspaceId", chosen);
      } catch (err) {
        console.error("Failed to load workspaces", err);
        setLoading(false);
      }
    }
    initWorkspaces();
  }, []);

  useEffect(() => {
    if (!activeWorkspaceId) return;

    async function loadWorkspaceRisk() {
      setLoading(true);
      setAnalyticsError("");
      try {
        const graphData = await graphApi.getGraph(activeWorkspaceId);
        const scopedNodes = graphData.nodes || [];
        const scopedEdges = graphData.edges || [];

        setNodes(scopedNodes);
        setEdges(scopedEdges);

        const pred = await analyticsApi.predictGraph({ nodes: scopedNodes, edges: scopedEdges });
        setAnalytics(pred?.predictions || null);
      } catch (error) {
        console.error("Failed to load risk analysis data", error);
        setAnalyticsError("Failed to analyze selected workspace. Make sure the analytics service is running on port 8001.");
      } finally {
        setLoading(false);
      }
    }

    loadWorkspaceRisk();
  }, [activeWorkspaceId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#b1b2ff]">progress_activity</span>
      </div>
    );
  }

  const nodeTypes = [...new Set(nodes.map((n) => n.data?.type).filter(Boolean))];
  const filteredNodes = filterType === "all" ? nodes : nodes.filter((n) => n.data?.type === filterType);

  const sortedNodes = [...filteredNodes].sort((a, b) => {
    const aVal = a.data?.[sortBy] ?? 0;
    const bVal = b.data?.[sortBy] ?? 0;
    return sortDir === "desc" ? bVal - aVal : aVal - bVal;
  });

  const riskScores = nodes.map((n) => n.data?.risk_score || 0);
  const avgRisk = riskScores.length ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length) : 0;
  const maxRisk = riskScores.length ? Math.max(...riskScores) : 0;
  const criticalCount = nodes.filter((n) => (n.data?.risk_score || 0) > 80).length;
  const highCount = nodes.filter((n) => { const s = n.data?.risk_score || 0; return s > 60 && s <= 80; }).length;
  const mediumCount = nodes.filter((n) => { const s = n.data?.risk_score || 0; return s > 30 && s <= 60; }).length;
  const lowCount = nodes.filter((n) => (n.data?.risk_score || 0) <= 30).length;

  // Compute risk by type
  const riskByType = {};
  nodes.forEach((n) => {
    const t = n.data?.type || "Unknown";
    if (!riskByType[t]) riskByType[t] = { total: 0, count: 0 };
    riskByType[t].total += n.data?.risk_score || 0;
    riskByType[t].count += 1;
  });

  const typeRiskEntries = Object.entries(riskByType)
    .map(([type, { total, count }]) => ({ type, avg: Math.round(total / count), count }))
    .sort((a, b) => b.avg - a.avg);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span className="material-symbols-outlined text-[14px] text-slate-300">unfold_more</span>;
    return <span className="material-symbols-outlined text-[14px] text-[#b1b2ff]">{sortDir === "desc" ? "expand_more" : "expand_less"}</span>;
  };

  const spof = analytics?.single_point_of_failure;
  const liveSummary = analytics?.summary;
  const vulnerabilities = analytics?.vulnerabilities || [];
  const bottlenecks = analytics?.bottlenecks || [];
  const geoLive = analytics?.geographic_risk;
  // Lowest-reliability nodes from graph (for Supplier Reliability panel)
  const reliabilityRanking = analytics?.reliability_ranking || [];
  // Highest-mismatch nodes from graph (for Demand-Supply Mismatch panel)
  const mismatchRanking = analytics?.mismatch_ranking || [];
  // All node predictions (for enriched SPOF reasons)
  const nodePredsMap = {};
  (analytics?.node_predictions || []).forEach((p) => { nodePredsMap[p.node_id] = p; });
  const spofNodes = (analytics?.node_predictions || []).filter((p) => p.is_articulation_point);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:gap-8 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900">Risk Analysis</h1>
          <p className="text-sm text-slate-500">Identify vulnerabilities across your supply chain</p>

          {workspaces.length > 0 && (
            <div className="mt-3 w-full sm:w-80">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Workspace
              </label>
              <select
                value={activeWorkspaceId || ""}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setActiveWorkspaceId(nextId);
                  localStorage.setItem("activeWorkspaceId", nextId);
                }}
                className="w-full rounded-xl border border-[#b1b2ff]/20 bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:border-[#b1b2ff] focus:outline-none focus:ring-1 focus:ring-[#b1b2ff]"
              >
                {workspaces.map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Showing data for {activeWorkspace?.name || "selected workspace"}
              </p>
            </div>
          )}
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50 sm:w-auto"
          onClick={handleComputeRisks}
          disabled={computing}
        >
          <span className="material-symbols-outlined text-[16px]">{computing ? "sync" : "shield"}</span>
          {computing ? "Computing\u2026" : "Compute Risks"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
          <RiskGauge value={avgRisk} size={80} />
          <div>
            <p className="text-xs text-slate-500">Average Risk</p>
            <p className="text-lg font-bold text-slate-900">{avgRisk}%</p>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Highest Risk</p>
          <p className="text-2xl font-black text-red-600">{maxRisk}%</p>
          <p className="text-[10px] text-slate-400">
            {nodes.find((n) => (n.data?.risk_score || 0) === maxRisk)?.data?.name || "—"}
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Risk Distribution</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{criticalCount} Critical</span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">{highCount} High</span>
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">{mediumCount} Med</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{lowCount} Low</span>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Network Connections</p>
          <p className="text-2xl font-black text-slate-900">{edges.length}</p>
          <p className="text-[10px] text-slate-400">supply chain links</p>
        </div>
      </div>

      {analyticsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {analyticsError}
        </div>
      )}

      {analytics && (
        <>
          {/* KPI summary row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button
              type="button"
              onClick={() => setShowSpofDetails((prev) => !prev)}
              className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 text-left shadow-sm transition hover:border-[#b1b2ff]/40 hover:bg-[#b1b2ff]/5"
            >
              <p className="text-xs text-slate-500">Single Point Failures</p>
              <p className="text-2xl font-black text-slate-900">
                {liveSummary?.single_point_failures ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                articulation points in this chain
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#6d6fd8]">
                {showSpofDetails ? "Hide identified points" : "Click to view identified points"}
              </p>
            </button>

            <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Geographic Concentration (HHI)</p>
              <p className="text-2xl font-black text-slate-900">
                {geoLive?.hhi_country ?? 0}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {geoLive?.concentration_level ?? "unknown"}
              </p>
            </div>

            <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Avg Chain Reliability</p>
              <p className="text-2xl font-black text-slate-900">
                {Math.round(100 - (liveSummary?.avg_predicted_risk || 0))}
              </p>
              <p className="text-[11px] text-slate-400">out of 100</p>
            </div>

            <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">High Mismatch Nodes</p>
              <p className="text-2xl font-black text-slate-900">
                {mismatchRanking.filter((n) => n.mismatch_index > 50).length}
              </p>
              <p className="text-[11px] text-slate-400">
                avg index: {mismatchRanking.length ? Math.round(mismatchRanking.reduce((a, b) => a + b.mismatch_index, 0) / mismatchRanking.length) : 0}
              </p>
            </div>
          </div>

          {showSpofDetails && (
            <div className="rounded-2xl border border-red-200 bg-red-50/40 p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-widest text-red-700">
                  Identified Single Points Of Failure
                </h4>
                <span className="text-[11px] font-semibold text-red-600">{spofNodes.length} found</span>
              </div>

              {spofNodes.length === 0 ? (
                <p className="text-sm text-slate-500">No articulation-point SPOFs detected in the selected workspace.</p>
              ) : (
                <div className="space-y-2">
                  {spofNodes.slice(0, 10).map((item, idx) => (
                    <div key={item.node_id || idx} className="rounded-lg border border-red-100 bg-white px-3 py-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                          <p className="text-[11px] text-slate-500">{item.country} • {item.type} • in {item.in_degree} / out {item.out_degree}</p>
                        </div>
                        <span className="text-xs font-bold text-red-600">risk {item.predicted_risk}</span>
                      </div>
                      {item.spof_reasons?.length > 0 && (
                        <p className="mt-1 text-[10px] italic text-slate-500">{item.spof_reasons.join(" · ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* ── SPOF Panel ─────────────────────────────────────────── */}
            <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                Single Point Of Failure Identification
              </h3>
              {spofNodes.length === 0 ? (
                <p className="text-sm text-slate-400">No SPOFs detected in this chain.</p>
              ) : (
                <div className="space-y-2">
                  {spofNodes.slice(0, 5).map((item, idx) => (
                    <div
                      key={item.node_id || idx}
                      className="rounded-lg border border-red-100 bg-red-50/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                        <span className="text-xs font-bold text-red-600">{item.predicted_risk}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <p className="text-[11px] text-slate-400">{item.country} • {item.type}</p>
                        {item.is_articulation_point && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">structural SPOF</span>
                        )}
                        {item.is_bottleneck && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">bottleneck ×{item.in_degree}</span>
                        )}
                      </div>
                      {item.spof_reasons && item.spof_reasons.length > 0 && (
                        <p className="mt-1 text-[10px] text-slate-400 italic">{item.spof_reasons.join(" · ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Geographic Concentration Panel ─────────────────────── */}
            <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                Geographic Concentration Risk
              </h3>
              {(geoLive?.countries || []).length === 0 ? (
                <p className="text-sm text-slate-400">No country data on nodes in this chain.</p>
              ) : (
                <div className="space-y-2">
                  {(geoLive.countries || []).slice(0, 5).map((item, idx) => (
                    <div
                      key={`${item.country}-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{item.country}</p>
                        <p className="text-[11px] text-slate-400">{item.count} node{item.count !== 1 ? "s" : ""} in chain</p>
                      </div>
                      <span className="text-xs font-bold text-slate-600">{item.share_pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Supplier Reliability Panel ──────────────────────────── */}
            <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                Supplier Reliability Scoring
              </h3>
              {reliabilityRanking.length === 0 ? (
                <p className="text-sm text-slate-400">No nodes in this chain.</p>
              ) : (
                <div className="space-y-2">
                  {reliabilityRanking.slice(0, 5).map((item, idx) => (
                    <div
                      key={item.node_id || idx}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                        <p className="text-[11px] text-slate-400">{item.country} • {item.type}</p>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-bold text-orange-600">{item.reliability}</span>
                        <span className="text-[10px] text-slate-400">reliability</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Demand-Supply Mismatch Panel ────────────────────────── */}
            <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
                Demand-Supply Mismatch Detection
              </h3>
              {mismatchRanking.length === 0 ? (
                <p className="text-sm text-slate-400">No nodes in this chain.</p>
              ) : (
                <div className="space-y-2">
                  {mismatchRanking.slice(0, 5).map((item, idx) => (
                    <div
                      key={item.node_id || idx}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {item.type} • in-deg {item.in_degree}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="block text-xs font-bold text-red-600">{item.mismatch_index}</span>
                        <span className="text-[10px] text-slate-400">mismatch</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Risk by node type */}
      <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Risk by Node Type</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {typeRiskEntries.map(({ type, avg, count }) => {
            const meta = NODE_META[type] || { icon: "hub", iconClass: "bg-slate-100 text-slate-600" };
            const barColor = avg <= 30 ? "bg-green-400" : avg <= 60 ? "bg-yellow-400" : avg <= 80 ? "bg-orange-400" : "bg-red-400";
            return (
              <div key={type} className="flex items-center gap-4 rounded-xl border border-slate-100 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.iconClass}`}>
                  <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">{type}</p>
                    <span className="text-xs font-bold text-slate-500">{avg}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${avg}%` }} />
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400">{count} node{count !== 1 ? "s" : ""}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Node risk table */}
      <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            All Nodes ({filteredNodes.length})
          </h3>
          <select
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All Types</option>
            {nodeTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
                </th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Country</th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("risk_score")}>
                  <span className="flex items-center gap-1">Risk <SortIcon field="risk_score" /></span>
                </th>
                <th className="pb-3 pr-4">Probability</th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("external_risk_score")}>
                  <span className="flex items-center gap-1">External <SortIcon field="external_risk_score" /></span>
                </th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("reliability_score")}>
                  <span className="flex items-center gap-1">Reliability <SortIcon field="reliability_score" /></span>
                </th>
                <th className="cursor-pointer pb-3 pr-4" onClick={() => toggleSort("lead_time_days")}>
                  <span className="flex items-center gap-1">Lead Time <SortIcon field="lead_time_days" /></span>
                </th>
                <th className="pb-3">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedNodes.map((node) => (
                <tr key={node.id} className="text-slate-700 transition-colors hover:bg-slate-50/50">
                  <td className="py-3 pr-4 font-medium">{node.data?.name}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded bg-[#b1b2ff]/10 px-2 py-0.5 text-[10px] font-medium text-[#6d6fd8]">
                      {node.data?.type}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{node.data?.country || "—"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <RiskBadge score={node.data?.risk_score || 0} />
                      <span className="text-xs font-bold">{node.data?.risk_score}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      node.data?.risk_probability === "Critical" ? "bg-red-100 text-red-700"
                        : node.data?.risk_probability === "High" ? "bg-orange-100 text-orange-700"
                        : node.data?.risk_probability === "Moderate" ? "bg-yellow-100 text-yellow-700"
                        : "bg-green-100 text-green-700"
                    }`}>{node.data?.risk_probability || "Low"}</span>
                  </td>
                  <td className="py-3 pr-4 text-xs font-bold">{node.data?.external_risk_score || 0}%</td>
                  <td className="py-3 pr-4 text-xs">{node.data?.reliability_score ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs">{node.data?.lead_time_days ?? 0}d</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      node.data?.compliance_status === "Compliant"
                        ? "bg-green-100 text-green-700"
                        : node.data?.compliance_status === "Non-Compliant"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                    }`}>
                      {node.data?.compliance_status || "Unknown"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
