import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { graphApi, workspaceApi } from "../services/api";
import { getHighRisk } from "../services/disruptionApi";
import { TIER_GROUPS } from "../constants/nodeMeta";

/* ───────── Sub-components ───────── */

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
  const totalCap = nodes.reduce((sum, n) => sum + (n.data?.capacity || 0), 0);
  const totalInv = nodes.reduce((sum, n) => sum + (n.data?.inventory || 0), 0);

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

      {/* Tier operational summary */}
      {(totalCap > 0 || totalInv > 0) && (
        <div className="mb-3 flex gap-3">
          <div className="flex-1 rounded-lg bg-white/60 px-3 py-2">
            <p className="text-[10px] text-slate-400">Total Capacity</p>
            <p className="text-sm font-bold text-slate-800">{totalCap.toLocaleString()}</p>
          </div>
          <div className="flex-1 rounded-lg bg-white/60 px-3 py-2">
            <p className="text-[10px] text-slate-400">Total Inventory</p>
            <p className="text-sm font-bold text-slate-800">{totalInv.toLocaleString()}</p>
          </div>
        </div>
      )}

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
                {(node.data?.capacity > 0 || node.data?.inventory > 0) && (
                  <span className="text-[10px] text-slate-400">
                    Cap: {node.data?.capacity || 0} · Inv: {node.data?.inventory || 0}
                  </span>
                )}
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

/* ───────── Main Page ───────── */

function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [disruptions, setDisruptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  // Workspace state
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [wsLoading, setWsLoading] = useState(true);

  // Load workspace list on mount
  useEffect(() => {
    async function initWorkspaces() {
      try {
        const res = await workspaceApi.list();
        const list = res.workspaces || [];
        setWorkspaces(list);
        if (list.length === 0) {
          setWsLoading(false);
          setLoading(false);
          return;
        }
        const saved = localStorage.getItem("activeWorkspaceId");
        const chosen = list.find((w) => w._id === saved)?._id || list[0]._id;
        setActiveWorkspaceId(chosen);
        localStorage.setItem("activeWorkspaceId", chosen);
      } catch (err) {
        console.error("Failed to load workspaces", err);
      } finally {
        setWsLoading(false);
      }
    }
    initWorkspaces();
  }, []);

  // Load dashboard data when workspace changes
  const load = async (wsId) => {
    if (!wsId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [graphData, disruptionRes] = await Promise.all([
        graphApi.getGraph(wsId),
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

      const probCounts = { Low: 0, Moderate: 0, High: 0, Critical: 0 };
      nodes.forEach((n) => {
        const p = n.data?.risk_probability || "Low";
        if (probCounts[p] !== undefined) probCounts[p]++;
      });

      // Operational metrics
      const totalCapacity = nodes.reduce((s, n) => s + (n.data?.capacity || 0), 0);
      const totalInventory = nodes.reduce((s, n) => s + (n.data?.inventory || 0), 0);

      const leadTimes = nodes.map((n) => n.data?.lead_time_days).filter((v) => v > 0);
      const avgLeadTime = leadTimes.length
        ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
        : 0;

      const reliabilities = nodes.map((n) => n.data?.reliability_score).filter((v) => v > 0);
      const avgReliability = reliabilities.length
        ? Math.round(reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length)
        : 0;

      // Compliance counts
      const gmpCounts = { Certified: 0, Pending: 0, "Non-Compliant": 0, Unknown: 0 };
      const fdaCounts = { Approved: 0, Pending: 0, "Not Required": 0, Rejected: 0, Unknown: 0 };
      let coldChainCount = 0;

      nodes.forEach((n) => {
        const gmp = n.data?.gmp_status || "Unknown";
        if (gmpCounts[gmp] !== undefined) gmpCounts[gmp]++;
        else gmpCounts.Unknown++;

        const fda = n.data?.fda_approval || "Unknown";
        if (fdaCounts[fda] !== undefined) fdaCounts[fda]++;
        else fdaCounts.Unknown++;

        if (n.data?.cold_chain_capable) coldChainCount++;
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
        totalCapacity,
        totalInventory,
        avgLeadTime,
        avgReliability,
        gmpCounts,
        fdaCounts,
        coldChainCount,
      });

      setDisruptions((disruptionRes.data || []).slice(0, 10));
    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspaceId) load(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const handleComputeRisks = async () => {
    setComputing(true);
    try {
      await graphApi.computeRisks();
      await load(activeWorkspaceId);
    } catch (error) {
      console.error("Failed to compute risks", error);
    } finally {
      setComputing(false);
    }
  };

  const handleWorkspaceChange = (id) => {
    setActiveWorkspaceId(id);
    localStorage.setItem("activeWorkspaceId", id);
  };

  const activeWorkspace = workspaces.find((w) => w._id === activeWorkspaceId);

  // Loading state
  if (wsLoading || (loading && !stats)) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#b1b2ff]">progress_activity</span>
          <p className="mt-2 text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // No workspaces at all
  if (workspaces.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#b1b2ff]/10">
          <span className="material-symbols-outlined text-4xl text-[#b1b2ff]">hub</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Workspaces Yet</h2>
        <p className="max-w-sm text-center text-sm text-slate-500">
          Create a workspace and build your supply chain network to see analytics here.
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

  // Has workspaces but no data for active one
  if (!stats || stats.totalNodes === 0) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
        {/* Workspace selector always visible */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-500">Supply chain overview and key metrics</p>
          </div>
          <select
            value={activeWorkspaceId || ""}
            onChange={(e) => handleWorkspaceChange(e.target.value)}
            className="w-full rounded-xl border border-[#b1b2ff]/20 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-[#b1b2ff] focus:outline-none focus:ring-1 focus:ring-[#b1b2ff] sm:w-72"
          >
            {workspaces.map((w) => (
              <option key={w._id} value={w._id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-100 bg-white p-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#b1b2ff]/10">
            <span className="material-symbols-outlined text-4xl text-[#b1b2ff]">hub</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Nodes in This Workspace</h2>
          <p className="max-w-sm text-center text-sm text-slate-500">
            Head to the Graph Builder to add supply chain nodes to <strong>{activeWorkspace?.name}</strong>.
          </p>
          <Link
            to="/app/graph"
            className="rounded-xl bg-[#b1b2ff] px-6 py-3 text-sm font-bold text-white hover:bg-[#9798f0]"
          >
            Open Graph Builder
          </Link>
        </div>
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
      {/* Header with workspace selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            {loading && (
              <span className="material-symbols-outlined animate-spin text-lg text-[#b1b2ff]">progress_activity</span>
            )}
          </div>
          {activeWorkspace && (
            <p className="mt-0.5 text-sm text-slate-500">
              {activeWorkspace.name}
              {activeWorkspace.description && (
                <span className="text-slate-400"> — {activeWorkspace.description}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={activeWorkspaceId || ""}
            onChange={(e) => handleWorkspaceChange(e.target.value)}
            className="w-full rounded-xl border border-[#b1b2ff]/20 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:border-[#b1b2ff] focus:outline-none focus:ring-1 focus:ring-[#b1b2ff] sm:w-64"
          >
            {workspaces.map((w) => (
              <option key={w._id} value={w._id}>{w.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-5 py-2.5 text-xs font-bold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
            onClick={handleComputeRisks}
            disabled={computing}
          >
            <span className="material-symbols-outlined text-[16px]">{computing ? "sync" : "shield"}</span>
            {computing ? "Computing…" : "Compute Risks"}
          </button>
        </div>
      </div>

      {/* KPI Row 1 — Network Overview */}
      <div>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Network Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        </div>
      </div>

      {/* KPI Row 2 — Operational Health */}
      <div>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Operational Health</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon="inventory_2"
            iconClass="bg-violet-50 text-violet-600"
            label="Total Capacity"
            value={stats.totalCapacity.toLocaleString()}
            sub="Across all nodes"
          />
          <KpiCard
            icon="warehouse"
            iconClass="bg-amber-50 text-amber-600"
            label="Total Inventory"
            value={stats.totalInventory.toLocaleString()}
            sub={stats.totalCapacity > 0 ? `${Math.round((stats.totalInventory / stats.totalCapacity) * 100)}% of capacity` : undefined}
          />
          <KpiCard
            icon="schedule"
            iconClass="bg-pink-50 text-pink-600"
            label="Avg Lead Time"
            value={stats.avgLeadTime > 0 ? `${stats.avgLeadTime}d` : "—"}
            sub="Days across supply chain"
          />
          <KpiCard
            icon="verified"
            iconClass="bg-teal-50 text-teal-600"
            label="Avg Reliability"
            value={stats.avgReliability > 0 ? `${stats.avgReliability}%` : "—"}
            sub={stats.avgReliability >= 80 ? "Strong reliability" : stats.avgReliability >= 50 ? "Moderate reliability" : stats.avgReliability > 0 ? "Needs attention" : "Not assessed"}
          />
        </div>
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

      {/* Compliance & Quality Summary */}
      <div>
        <h2 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Compliance & Quality</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* GMP Status */}
          <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="material-symbols-outlined text-[16px] text-violet-500">verified</span>
              GMP Status
            </h3>
            <div className="space-y-2">
              {[
                { label: "Certified", count: stats.gmpCounts.Certified, color: "bg-green-100 text-green-700" },
                { label: "Pending", count: stats.gmpCounts.Pending, color: "bg-yellow-100 text-yellow-700" },
                { label: "Non-Compliant", count: stats.gmpCounts["Non-Compliant"], color: "bg-red-100 text-red-700" },
                { label: "Unknown", count: stats.gmpCounts.Unknown, color: "bg-slate-100 text-slate-600" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${item.color}`}>{item.label}</span>
                  <span className="text-sm font-bold text-slate-700">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* FDA Approval */}
          <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="material-symbols-outlined text-[16px] text-blue-500">local_pharmacy</span>
              FDA Approval
            </h3>
            <div className="space-y-2">
              {[
                { label: "Approved", count: stats.fdaCounts.Approved, color: "bg-green-100 text-green-700" },
                { label: "Pending", count: stats.fdaCounts.Pending, color: "bg-yellow-100 text-yellow-700" },
                { label: "Not Required", count: stats.fdaCounts["Not Required"], color: "bg-slate-100 text-slate-500" },
                { label: "Rejected", count: stats.fdaCounts.Rejected, color: "bg-red-100 text-red-700" },
                { label: "Unknown", count: stats.fdaCounts.Unknown, color: "bg-slate-100 text-slate-600" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${item.color}`}>{item.label}</span>
                  <span className="text-sm font-bold text-slate-700">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cold Chain & Quick Stats */}
          <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-600">
              <span className="material-symbols-outlined text-[16px] text-cyan-500">ac_unit</span>
              Infrastructure
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Cold Chain Capable</span>
                  <span className="text-sm font-bold text-slate-700">{stats.coldChainCount} / {stats.totalNodes}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${stats.totalNodes > 0 ? (stats.coldChainCount / stats.totalNodes) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Active Disruptions</span>
                  <span className="text-sm font-bold text-orange-600">{disruptions.length}</span>
                </div>
                <p className="text-[10px] text-slate-400">External events with severity &ge; 60</p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Inventory / Capacity</span>
                  <span className="text-sm font-bold text-slate-700">
                    {stats.totalCapacity > 0 ? `${Math.round((stats.totalInventory / stats.totalCapacity) * 100)}%` : "—"}
                  </span>
                </div>
                {stats.totalCapacity > 0 && (
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-amber-400 transition-all"
                      style={{ width: `${Math.min(100, (stats.totalInventory / stats.totalCapacity) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

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

      {/* Grid: Type breakdown + Geography + Quick actions */}
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
              to="/app/heatmap"
              className="flex items-center gap-3 rounded-xl border border-[#b1b2ff]/10 p-4 transition-colors hover:border-[#b1b2ff]/30 hover:bg-[#b1b2ff]/5"
            >
              <span className="material-symbols-outlined text-emerald-500">map</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Demand Heatmap</p>
                <p className="text-[11px] text-slate-400">View demand vs supply gaps</p>
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
