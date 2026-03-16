import { useEffect, useState } from "react";
import { graphApi } from "../services/api";
import { NODE_META } from "../constants/nodeMeta";

const DISRUPTION_TYPES = [
  { id: "supplier_failure", label: "Supplier Failure", icon: "error", desc: "A key supplier goes offline" },
  { id: "transport_delay", label: "Transport Delay", icon: "local_shipping", desc: "Logistics disruption on a route" },
  { id: "demand_surge", label: "Demand Surge", icon: "trending_up", desc: "Sudden increase in demand" },
  { id: "natural_disaster", label: "Natural Disaster", icon: "flood", desc: "Regional catastrophe impacting facilities" },
  { id: "quality_issue", label: "Quality Issue", icon: "gpp_bad", desc: "Batch recall or quality failure" },
  { id: "regulatory_change", label: "Regulatory Change", icon: "gavel", desc: "New compliance requirements" },
];

function SimulationPage() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDisruption, setSelectedDisruption] = useState(null);
  const [targetNodeId, setTargetNodeId] = useState("");
  const [severity, setSeverity] = useState(50);
  const [duration, setDuration] = useState(7);
  const [simResult, setSimResult] = useState(null);
  const [simRunning, setSimRunning] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await graphApi.getGraph();
        setNodes(data.nodes || []);
      } catch (error) {
        console.error("Failed to load graph", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const runSimulation = () => {
    if (!selectedDisruption || !targetNodeId) return;

    setSimRunning(true);
    setSimResult(null);

    // Client-side simulation model
    setTimeout(() => {
      const targetNode = nodes.find((n) => n.id === targetNodeId);
      const baseRisk = targetNode?.data?.risk_score || 0;
      const impactMultiplier = severity / 100;

      // Calculate cascading impacts
      const affectedNodes = nodes
        .filter((n) => n.id !== targetNodeId)
        .map((n) => {
          const distance = Math.random(); // Simplified proximity
          const cascadeRisk = Math.min(
            100,
            Math.round((n.data?.risk_score || 0) + (severity * (1 - distance) * 0.4))
          );
          return {
            id: n.id,
            name: n.data?.name,
            type: n.data?.type,
            originalRisk: n.data?.risk_score || 0,
            simulatedRisk: cascadeRisk,
            delta: cascadeRisk - (n.data?.risk_score || 0),
          };
        })
        .sort((a, b) => b.delta - a.delta);

      const avgOriginal = Math.round(nodes.reduce((s, n) => s + (n.data?.risk_score || 0), 0) / nodes.length);
      const avgSimulated = Math.round(
        (affectedNodes.reduce((s, n) => s + n.simulatedRisk, 0) + Math.min(100, baseRisk + severity * 0.6)) /
          nodes.length
      );

      setSimResult({
        disruption: DISRUPTION_TYPES.find((d) => d.id === selectedDisruption),
        targetNode: targetNode?.data,
        severity,
        duration,
        impactedNodeCount: affectedNodes.filter((n) => n.delta > 5).length,
        avgOriginal,
        avgSimulated,
        affectedNodes: affectedNodes.slice(0, 10),
        overallImpact: Math.round(impactMultiplier * 100),
        recoveryEstimate: Math.round(duration * (1 + impactMultiplier)),
      });

      setSimRunning(false);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#b1b2ff]">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Scenario Simulation</h1>
        <p className="text-sm text-slate-500">Model disruptions and forecast cascading impacts</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Scenario builder */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
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

            {/* Target node */}
            <label className="mb-5 block">
              <span className="text-[10px] font-bold uppercase text-slate-400">Target Node</span>
              <select
                className="mt-1 w-full rounded-xl border border-[#b1b2ff]/10 bg-[#b1b2ff]/5 px-4 py-3 text-sm font-medium"
                value={targetNodeId}
                onChange={(e) => setTargetNodeId(e.target.value)}
              >
                <option value="">Select a node...</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>{n.data?.name} ({n.data?.type})</option>
                ))}
              </select>
            </label>

            {/* Severity */}
            <label className="mb-5 block">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-slate-400">Severity</span>
                <span className="text-xs font-bold text-[#b1b2ff]">{severity}%</span>
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
          </div>
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
          )}

          {simRunning && (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-[#b1b2ff]/10 bg-white p-12">
              <span className="material-symbols-outlined animate-spin text-5xl text-[#b1b2ff]">progress_activity</span>
              <p className="mt-4 text-sm font-semibold text-slate-600">Running simulation model...</p>
            </div>
          )}

          {simResult && (
            <div className="flex flex-col gap-6">
              {/* Impact summary */}
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

              {/* Scenario detail */}
              <div className="rounded-2xl border border-[#b1b2ff]/10 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    <span className="material-symbols-outlined">{simResult.disruption.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{simResult.disruption.label}</p>
                    <p className="text-xs text-slate-500">
                      Target: {simResult.targetNode?.name} · Severity: {simResult.severity}% · Duration: {simResult.duration}d
                    </p>
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
      </div>
    </div>
  );
}

export default SimulationPage;
