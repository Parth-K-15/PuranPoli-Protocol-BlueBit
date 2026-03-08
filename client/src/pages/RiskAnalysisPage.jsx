import { useEffect, useState } from "react";
import { graphApi } from "../services/api";
import { NODE_META } from "../constants/nodeMeta";

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

function RiskAnalysisPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("risk_score");
  const [sortDir, setSortDir] = useState("desc");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    async function load() {
      try {
        const data = await graphApi.getGraph();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      } catch (error) {
        console.error("Failed to load graph", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#a390f9]">progress_activity</span>
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
    return <span className="material-symbols-outlined text-[14px] text-[#a390f9]">{sortDir === "desc" ? "expand_more" : "expand_less"}</span>;
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Risk Analysis</h1>
        <p className="text-sm text-slate-500">Identify vulnerabilities across your supply chain</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-center gap-4 rounded-2xl border border-[#a390f9]/10 bg-white p-5 shadow-sm">
          <RiskGauge value={avgRisk} size={80} />
          <div>
            <p className="text-xs text-slate-500">Average Risk</p>
            <p className="text-lg font-bold text-slate-900">{avgRisk}%</p>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-[#a390f9]/10 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Highest Risk</p>
          <p className="text-2xl font-black text-red-600">{maxRisk}%</p>
          <p className="text-[10px] text-slate-400">
            {nodes.find((n) => (n.data?.risk_score || 0) === maxRisk)?.data?.name || "—"}
          </p>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-[#a390f9]/10 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Risk Distribution</p>
          <div className="mt-2 flex gap-2">
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{criticalCount} Critical</span>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">{highCount} High</span>
            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">{mediumCount} Med</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">{lowCount} Low</span>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-2xl border border-[#a390f9]/10 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">Network Connections</p>
          <p className="text-2xl font-black text-slate-900">{edges.length}</p>
          <p className="text-[10px] text-slate-400">supply chain links</p>
        </div>
      </div>

      {/* Risk by node type */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
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
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
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
                    <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-medium text-[#6f59d9]">
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

export default RiskAnalysisPage;
