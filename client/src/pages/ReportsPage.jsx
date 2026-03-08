import { useEffect, useState } from "react";
import { graphApi } from "../services/api";
import { NODE_META } from "../constants/nodeMeta";

function ReportsPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState("csv");

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

  const downloadCSV = (filename, headers, rows) => {
    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const downloadJSON = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportNodes = () => {
    if (exportFormat === "json") {
      downloadJSON("supply_chain_nodes.json", nodes.map((n) => n.data));
      return;
    }
    const headers = ["ID", "Name", "Type", "Country", "Region", "Capacity", "Inventory", "Risk Score", "Lead Time", "Reliability", "Dependency %", "Compliance"];
    const rows = nodes.map((n) => [
      n.id, n.data?.name, n.data?.type, n.data?.country, n.data?.region,
      n.data?.capacity, n.data?.inventory, n.data?.risk_score, n.data?.lead_time_days,
      n.data?.reliability_score, n.data?.dependency_percentage, n.data?.compliance_status,
    ]);
    downloadCSV("supply_chain_nodes.csv", headers, rows);
  };

  const exportEdges = () => {
    if (exportFormat === "json") {
      downloadJSON("supply_chain_edges.json", edges);
      return;
    }
    const headers = ["Edge ID", "Source", "Target"];
    const rows = edges.map((e) => [e.id, e.source, e.target]);
    downloadCSV("supply_chain_edges.csv", headers, rows);
  };

  const exportFullGraph = () => {
    const graphData = {
      exportedAt: new Date().toISOString(),
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        avgRisk: nodes.length
          ? Math.round(nodes.reduce((s, n) => s + (n.data?.risk_score || 0), 0) / nodes.length)
          : 0,
      },
      nodes: nodes.map((n) => n.data),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })),
    };
    downloadJSON("supply_chain_full_report.json", graphData);
  };

  const exportRiskReport = () => {
    const highRisk = nodes.filter((n) => (n.data?.risk_score || 0) > 60);
    if (exportFormat === "json") {
      downloadJSON("risk_report.json", highRisk.map((n) => n.data));
      return;
    }
    const headers = ["Name", "Type", "Country", "Risk Score", "Reliability", "Lead Time", "Compliance"];
    const rows = highRisk
      .sort((a, b) => (b.data?.risk_score || 0) - (a.data?.risk_score || 0))
      .map((n) => [
        n.data?.name, n.data?.type, n.data?.country, n.data?.risk_score,
        n.data?.reliability_score, n.data?.lead_time_days, n.data?.compliance_status,
      ]);
    downloadCSV("risk_report.csv", headers, rows);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#a390f9]">progress_activity</span>
      </div>
    );
  }

  // Summary stats
  const riskScores = nodes.map((n) => n.data?.risk_score || 0);
  const avgRisk = riskScores.length ? Math.round(riskScores.reduce((a, b) => a + b, 0) / riskScores.length) : 0;
  const highRiskCount = nodes.filter((n) => (n.data?.risk_score || 0) > 60).length;

  const reportCards = [
    {
      title: "Full Graph Report",
      desc: "Complete network export with nodes, edges, and summary statistics",
      icon: "description",
      iconClass: "bg-[#a390f9]/10 text-[#a390f9]",
      action: exportFullGraph,
      format: "JSON",
    },
    {
      title: "Node Data Export",
      desc: `Export all ${nodes.length} node records with properties`,
      icon: "table_chart",
      iconClass: "bg-blue-50 text-blue-600",
      action: exportNodes,
    },
    {
      title: "Edge Data Export",
      desc: `Export all ${edges.length} connection records`,
      icon: "timeline",
      iconClass: "bg-emerald-50 text-emerald-600",
      action: exportEdges,
    },
    {
      title: "Risk Report",
      desc: `${highRiskCount} high-risk nodes identified for review`,
      icon: "shield",
      iconClass: "bg-red-50 text-red-600",
      action: exportRiskReport,
    },
  ];

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Export</h1>
          <p className="text-sm text-slate-500">Generate and download supply chain reports</p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-[#a390f9]/10 bg-white p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              exportFormat === "csv" ? "bg-[#a390f9] text-white" : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setExportFormat("csv")}
          >
            CSV
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              exportFormat === "json" ? "bg-[#a390f9] text-white" : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setExportFormat("json")}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Summary snapshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Total Records</p>
          <p className="text-3xl font-black text-slate-900">{nodes.length + edges.length}</p>
          <p className="text-[10px] text-slate-400">{nodes.length} nodes + {edges.length} edges</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Avg Risk Score</p>
          <p className="text-3xl font-black text-slate-900">{avgRisk}%</p>
          <p className="text-[10px] text-slate-400">across all nodes</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase text-slate-400">Node Types</p>
          <p className="text-3xl font-black text-slate-900">{new Set(nodes.map((n) => n.data?.type)).size}</p>
          <p className="text-[10px] text-slate-400">unique categories</p>
        </div>
      </div>

      {/* Export cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {reportCards.map((card) => (
          <div key={card.title} className="flex items-start gap-4 rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconClass}`}>
              <span className="material-symbols-outlined">{card.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">{card.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{card.desc}</p>
              <button
                type="button"
                className="mt-3 flex items-center gap-1 rounded-lg bg-[#a390f9]/10 px-3 py-1.5 text-xs font-bold text-[#a390f9] transition-colors hover:bg-[#a390f9]/20"
                onClick={card.action}
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download {card.format || exportFormat.toUpperCase()}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview table of recent nodes */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Data Preview (first 10 nodes)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Type</th>
                <th className="pb-3 pr-4">Country</th>
                <th className="pb-3 pr-4">Risk</th>
                <th className="pb-3">Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {nodes.slice(0, 10).map((node) => (
                <tr key={node.id} className="text-slate-700">
                  <td className="py-3 pr-4 font-medium">{node.data?.name}</td>
                  <td className="py-3 pr-4">
                    <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-medium text-[#6f59d9]">
                      {node.data?.type}
                    </span>
                  </td>
                  <td className="py-3 pr-4">{node.data?.country || "—"}</td>
                  <td className="py-3 pr-4 text-xs font-bold">{node.data?.risk_score}%</td>
                  <td className="py-3 text-xs">{node.data?.capacity || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportsPage;
