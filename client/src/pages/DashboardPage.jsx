import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { graphApi } from "../services/api";
import { getDisruptions, getHighRisk } from "../services/disruptionApi";
import { TIER_GROUPS } from "../constants/nodeMeta";

function KpiCard({ icon, iconClass, label, value, sub }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-black text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
        {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

function RiskBadge({ score }) {
  if (score <= 30) return <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Low</span>;
  if (score <= 60) return <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">Medium</span>;
  if (score <= 80) return <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">High</span>;
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Critical</span>;
}

function TierSection({ group, nodes }) {
  if (nodes.length === 0) {
    return (
      <div className={`rounded-2xl border p-5 ${group.accentColor}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${group.iconClass}`}>
            <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{group.label}</h3>
            <p className="text-[10px] text-slate-400">{group.subtitle}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">No nodes in this tier yet.</p>
      </div>
    );
  }

  const avgRisk = Math.round(
    nodes.reduce((sum, n) => sum + (n.data?.risk_score || 0), 0) / nodes.length
  );
  const highRiskCount = nodes.filter((n) => (n.data?.risk_score || 0) > 60).length;

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${group.accentColor}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${group.iconClass}`}>
            <span className="material-symbols-outlined text-[20px]">{group.icon}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{group.label}</h3>
            <p className="text-[10px] text-slate-400">{group.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-lg font-black text-slate-900">{nodes.length}</p>
            <p className="text-[10px] text-slate-400">nodes</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-slate-900">{avgRisk}%</p>
            <p className="text-[10px] text-slate-400">avg risk</p>
          </div>
          {highRiskCount > 0 && (
            <div className="text-right">
              <p className="text-lg font-black text-red-600">{highRiskCount}</p>
              <p className="text-[10px] text-red-400">high risk</p>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-2">
        {nodes
          .sort((a, b) => (b.data?.risk_score || 0) - (a.data?.risk_score || 0))
          .slice(0, 5)
          .map((node) => (
            <div
              key={node.id}
              className="flex items-center justify-between rounded-xl border border-white/60 bg-white/80 p-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">{node.data?.name}</span>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  {node.data?.country || "Unassigned"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <RiskBadge score={node.data?.risk_score || 0} />
                <span className="text-xs font-bold text-slate-600">{node.data?.risk_score || 0}%</span>
              </div>
            </div>
          ))}
        {nodes.length > 5 && (
          <p className="pt-1 text-center text-[10px] text-slate-400">
            + {nodes.length - 5} more nodes
          </p>
        )}
      </div>
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const load = async () => {
    try {
      const [graphData, disruptionRes] = await Promise.all([
        graphApi.getGraph(localStorage.getItem("activeWorkspaceId")),
        getHighRisk().catch(() => ({ data: [] })),
      ]);

      const nodes = graphData.nodes || [];
      const edges = graphData.edges || [];

      const riskScores = nodes.map((n) => n.data?.risk_score || 0);
      const avgRisk = riskScores.length
        ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length)
        : 0;

      const highRiskNodes = nodes.filter((n) => (n.data?.risk_score || 0) > 60);

      const typeCounts = {};
      nodes.forEach((n) => {
        const t = n.data?.type || "Unknown";
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      });

      const countryCounts = {};
      nodes.forEach((n) => {
        const c = n.data?.country || "Unassigned";
        countryCounts[c] = (countryCounts[c] || 0) + 1;
      });

      // Count risk probabilities
      const probCounts = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
      nodes.forEach((n) => {
        const p = n.data?.risk_probability || "Low";
        if (probCounts[p] !== undefined) probCounts[p]++;
      });

      setStats({
        totalNodes: nodes.length,
        totalEdges: edges.length,
        avgRisk,
        highRiskNodes,
        typeCounts,
        countryCounts,
        nodes,
        probCounts,
      });

      setDisruptions((disruptionRes.data || []).slice(0, 10));
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleComputeRisks = async () => {
    setComputing(true);
    try {
      await graphApi.computeRisks();
      await load();
    } catch (error) {
      console.error("Failed to compute risks", error);
    } finally {
      setComputing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#b1b2ff]">progress_activity</span>
          <p className="mt-2 text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!stats || stats.totalNodes === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#b1b2ff]/10">
          <span className="material-symbols-outlined text-4xl text-[#b1b2ff]">hub</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Graph Data Yet</h2>
        <p className="max-w-sm text-center text-sm text-slate-500">
          Head to the Graph Builder to create your supply chain network, or load the demo to explore.
        </p>
        <Link
          to="/app/graph"
          className="rounded-xl bg-[#b1b2ff] px-6 py-3 text-sm font-bold text-white hover:bg-[#9798f0]"
        >
          Open Graph Builder
        </Link>
      </div>
    );
  }

  const topTypes = Object.entries(stats.typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topCountries = Object.entries(stats.countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const tierData = TIER_GROUPS.map((group) => ({
    group,
    nodes: stats.nodes.filter((n) => group.types.includes(n.data?.type)),
  }));

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:gap-8 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Supply chain overview and key metrics</p>
        </div>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50 sm:w-auto"
          onClick={handleComputeRisks}
          disabled={computing}
        >
          <span className="material-symbols-outlined text-[16px]">{computing ? "sync" : "shield"}</span>
          {computing ? "Computing…" : "Compute Risks"}
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon="hub" iconClass="bg-[#b1b2ff]/10 text-[#b1b2ff]" label="Total Nodes" value={stats.totalNodes} />
        <KpiCard icon="timeline" iconClass="bg-blue-50 text-blue-600" label="Total Edges" value={stats.totalEdges} />
        <KpiCard
          icon="speed"
          iconClass="bg-emerald-50 text-emerald-600"
          label="Avg Risk Score"
          value={`${stats.avgRisk}%`}
          sub={stats.avgRisk > 60 ? "Above threshold" : "Within range"}
        />
        <KpiCard
          icon="warning"
          iconClass="bg-red-50 text-red-600"
          label="High Risk Nodes"
          value={stats.highRiskNodes.length}
          sub={`of ${stats.totalNodes} total`}
        />
        <KpiCard
          icon="bolt"
          iconClass="bg-orange-50 text-orange-600"
          label="Active Disruptions"
          value={disruptions.length}
          sub="Severity ≥ 60"
        />
      </div>

      {/* Risk Probability Distribution */}
      {stats.totalNodes > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Low", color: "bg-green-100 text-green-700 border-green-200", count: stats.probCounts.Low },
            { label: "Moderate", color: "bg-yellow-100 text-yellow-700 border-yellow-200", count: stats.probCounts.Moderate },
            { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200", count: stats.probCounts.High },
            { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", count: stats.probCounts.Critical },
          ].map((item) => (
            <div key={item.label} className={`flex items-center justify-between rounded-xl border p-3 ${item.color}`}>
              <span className="text-xs font-bold">{item.label}</span>
              <span className="text-lg font-black">{item.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Supply Chain Tiers */}
      <div>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
          Supply Chain Tiers
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {tierData.map(({ group, nodes }) => (
            <TierSection key={group.key} group={group} nodes={nodes} />
          ))}
        </div>
      </div>

      {/* Grid: Type breakdown + Geography + High-risk table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* By Type */}
        <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Nodes by Type</h3>
          <div className="space-y-3">
            {topTypes.map(([type, count]) => {
              const pct = Math.round((count / stats.totalNodes) * 100);
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{type}</span>
                    <span className="text-xs text-slate-400">{count} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-[#b1b2ff]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By Country */}
        <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Geographic Spread</h3>
          <div className="space-y-3">
            {topCountries.map(([country, count]) => {
              const pct = Math.round((count / stats.totalNodes) * 100);
              return (
                <div key={country} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <span className="material-symbols-outlined text-[16px]">location_on</span>
                    </div>
                    <span className="text-sm font-medium text-slate-700">{country}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{count}</p>
                    <p className="text-[10px] text-slate-400">{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Quick Actions</h3>
          <div className="space-y-3">
            <Link
              to="/app/graph"
              className="flex items-center gap-3 rounded-xl border border-[#b1b2ff]/10 p-4 transition-colors hover:border-[#b1b2ff]/30 hover:bg-[#b1b2ff]/5"
            >
              <span className="material-symbols-outlined text-[#b1b2ff]">edit</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Edit Graph</p>
                <p className="text-[11px] text-slate-400">Add or modify supply chain nodes</p>
              </div>
            </Link>
            <Link
              to="/app/risk"
              className="flex items-center gap-3 rounded-xl border border-[#b1b2ff]/10 p-4 transition-colors hover:border-[#b1b2ff]/30 hover:bg-[#b1b2ff]/5"
            >
              <span className="material-symbols-outlined text-orange-500">shield</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Analyze Risks</p>
                <p className="text-[11px] text-slate-400">View risk scores and vulnerabilities</p>
              </div>
            </Link>
            <Link
              to="/app/simulation"
              className="flex items-center gap-3 rounded-xl border border-[#b1b2ff]/10 p-4 transition-colors hover:border-[#b1b2ff]/30 hover:bg-[#b1b2ff]/5"
            >
              <span className="material-symbols-outlined text-blue-500">science</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Run Simulation</p>
                <p className="text-[11px] text-slate-400">Model disruption scenarios</p>
              </div>
            </Link>
            <Link
              to="/app/reports"
              className="flex items-center gap-3 rounded-xl border border-[#b1b2ff]/10 p-4 transition-colors hover:border-[#b1b2ff]/30 hover:bg-[#b1b2ff]/5"
            >
              <span className="material-symbols-outlined text-emerald-500">download</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Export Report</p>
                <p className="text-[11px] text-slate-400">Generate PDF or CSV exports</p>
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* High-risk nodes table */}
      {stats.highRiskNodes.length > 0 && (
        <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">
            High Risk Nodes ({stats.highRiskNodes.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Country</th>
                  <th className="pb-3 pr-4">Risk</th>
                  <th className="pb-3 pr-4">Probability</th>
                  <th className="pb-3 pr-4">External</th>
                  <th className="pb-3">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.highRiskNodes
                  .sort((a, b) => (b.data?.risk_score || 0) - (a.data?.risk_score || 0))
                  .map((node) => (
                    <tr key={node.id} className="text-slate-700">
                      <td className="py-3 pr-4 font-medium">{node.data?.name}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded bg-[#b1b2ff]/10 px-2 py-0.5 text-[10px] font-medium text-[#6d6fd8]">
                          {node.data?.type}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{node.data?.country || "—"}</td>
                      <td className="py-3 pr-4">
                        <RiskBadge score={node.data?.risk_score || 0} />
                        <span className="ml-2 text-xs font-bold">{node.data?.risk_score}%</span>
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
                      <td className="py-3">{node.data?.compliance_status || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* External Disruption Alerts */}
      {disruptions.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange-600">
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              External Disruption Alerts
            </h3>
            <Link to="/app/disruptions" className="text-xs font-bold text-orange-600 hover:text-orange-800">View all →</Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {disruptions.slice(0, 6).map((d) => (
              <div key={d._id} className="rounded-xl border border-orange-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">{d.event_type?.replace(/_/g, " ")}</span>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    d.severity_score >= 80 ? "bg-red-100 text-red-700"
                      : d.severity_score >= 60 ? "bg-orange-100 text-orange-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>{d.severity_score}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{d.description}</p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{d.source_type}</span>
                  <span>·</span>
                  <span>{d.location}, {d.country}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
