import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  TrendingUp,
  Radio,
  RefreshCw,
  Zap,
} from "lucide-react";
import { getStats, getHighRisk, triggerIngest } from "../services/disruptionApi";
import SeverityBadge from "../components/SeverityBadge";
import Spinner from "../components/Spinner";

const PIE_COLORS = ["#06b6d4", "#f97316", "#a855f7"];
const SEVERITY_COLORS = { 0: "#22c55e", 30: "#eab308", 60: "#f97316", 80: "#ef4444" };
const SEVERITY_LABELS = { 0: "Low (0-29)", 30: "Moderate (30-59)", 60: "High (60-79)", 80: "Critical (80-100)" };

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [highRisk, setHighRisk] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([getStats(), getHighRisk()]);
      setStats(s.data);
      setHighRisk(h.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      await triggerIngest();
      await fetchData();
    } finally {
      setIngesting(false);
    }
  };

  if (loading) return <Spinner />;

  const sourceData = (stats?.bySource || []).map((s) => ({
    name: s._id || "unknown",
    count: s.count,
    avgSeverity: Math.round(s.avgSeverity || 0),
  }));

  const severityData = (stats?.bySeverity || []).map((s) => ({
    name: SEVERITY_LABELS[s._id] || `${s._id}+`,
    value: s.count,
    fill: SEVERITY_COLORS[s._id] || "#6b7280",
  }));

  const typeData = (stats?.byType || []).map((t) => ({
    name: t._id?.replace(/_/g, " ") || "unknown",
    count: t.count,
    avgSeverity: Math.round(t.avgSeverity || 0),
  }));

  const totalEvents = sourceData.reduce((s, d) => s + d.count, 0);
  const criticalCount = highRisk.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Intelligence Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            External Disruption Intelligence Layer — real-time signal monitoring
          </p>
        </div>
        <button
          onClick={handleIngest}
          disabled={ingesting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`h-4 w-4 ${ingesting ? "animate-spin" : ""}`} />
          {ingesting ? "Ingesting…" : "Run Ingestion"}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={Radio}
          label="Total Signals"
          value={totalEvents}
          color="cyan"
        />
        <KpiCard
          icon={AlertTriangle}
          label="High-Risk Events"
          value={criticalCount}
          color="red"
        />
        <KpiCard
          icon={TrendingUp}
          label="Source Types"
          value={sourceData.length}
          color="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Source bar */}
        <ChartCard title="Signals by Source">
          {sourceData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={sourceData}>
                <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                  labelStyle={{ color: "#d1d5db" }}
                />
                <Bar dataKey="count" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Severity pie */}
        <ChartCard title="Severity Distribution">
          {severityData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={4}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend
                  wrapperStyle={{ fontSize: 12, color: "#9ca3af" }}
                />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Event type breakdown */}
      <ChartCard title="Signals by Event Type">
        {typeData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeData} layout="vertical">
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={160} />
              <Tooltip
                contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8 }}
                labelStyle={{ color: "#d1d5db" }}
              />
              <Bar dataKey="count" fill="#a855f7" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* High-risk alerts table */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
        <h2 className="text-base font-semibold text-white flex items-center gap-2 mb-4">
          <Zap className="h-4 w-4 text-red-400" />
          High-Risk Disruption Events
        </h2>
        {highRisk.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No high-risk events detected — all signals within safe thresholds.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left py-2 pr-4 font-medium">Event</th>
                  <th className="text-left py-2 pr-4 font-medium">Source</th>
                  <th className="text-left py-2 pr-4 font-medium">Location</th>
                  <th className="text-left py-2 pr-4 font-medium">Severity</th>
                  <th className="text-left py-2 font-medium">Detected</th>
                </tr>
              </thead>
              <tbody>
                {highRisk.slice(0, 10).map((e) => (
                  <tr key={e._id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2.5 pr-4 text-white capitalize">
                      {e.event_type?.replace(/_/g, " ")}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-400">{e.source_type}</td>
                    <td className="py-2.5 pr-4 text-gray-400">
                      {e.location}, {e.country}
                    </td>
                    <td className="py-2.5 pr-4">
                      <SeverityBadge score={e.severity_score} />
                    </td>
                    <td className="py-2.5 text-gray-500 text-xs">
                      {new Date(e.detected_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Helper components ─────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, color }) {
  const colors = {
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };
  return (
    <div className={`rounded-xl border p-5 ${colors[color]}`}>
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <span className="text-sm font-medium text-gray-400">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
      <h2 className="text-base font-semibold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-52 text-gray-600 text-sm">
      No data yet — trigger an ingestion run to populate.
    </div>
  );
}
