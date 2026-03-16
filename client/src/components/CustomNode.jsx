import { Handle, Position } from "@xyflow/react";
import { NODE_META } from "../constants/nodeMeta";

const typeStyles = {
  RawMaterialSource: "border-sky-400 bg-sky-50 text-sky-900",
  Tier3Supplier: "border-indigo-400 bg-indigo-50 text-indigo-900",
  Tier2Supplier: "border-violet-400 bg-violet-50 text-violet-900",
  Tier1Supplier: "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-900",
  Manufacturer: "border-cyan-400 bg-cyan-50 text-cyan-900",
  Warehouse: "border-emerald-400 bg-emerald-50 text-emerald-900",
  ColdStorage: "border-teal-400 bg-teal-50 text-teal-900",
  Distributor: "border-blue-400 bg-blue-50 text-blue-900",
  Retailer: "border-rose-400 bg-rose-50 text-rose-900",
};

const riskClass = (riskScore = 0, riskProbability) => {
  if (riskProbability === "Critical" || riskScore > 80) {
    return "ring-2 ring-red-500 shadow-red-400/40 shadow-lg";
  }
  if (riskProbability === "High" || riskScore > 60) {
    return "ring-2 ring-red-400 shadow-red-300/30 shadow-lg";
  }
  if (riskScore <= 30) {
    return "ring-2 ring-green-400";
  }
  return "ring-2 ring-yellow-400";
};

function CustomNode({ data, selected }) {
  const typeClass = typeStyles[data.type] || "border-slate-300 bg-white text-slate-900";
  const isSpofNode = Boolean(
    data.is_spof || data.is_articulation_point || data.single_point_of_failure
  );
  const meta = NODE_META[data.type] || {
    icon: "hub",
    title: data.type,
    subtitle: "Supply Entity",
    iconClass: "bg-slate-200 text-slate-700",
  };

  return (
    <div
      className={`w-52 cursor-move rounded-2xl border-2 p-4 transition-all ${
        isSpofNode
          ? "border-[#ff758f] bg-[#ff758f]/20 text-[#a61f3c]"
          : (data.risk_probability === "Critical" || data.risk_probability === "High")
          ? "border-red-400 bg-red-50 text-red-900"
          : typeClass
      } ${
        selected
          ? "ring-4 ring-[#a390f9] ring-offset-2 shadow-xl shadow-[#a390f9]/40"
          : riskClass(data.risk_score, data.risk_probability)
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-[#b1b2ff]" />

      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-[#b1b2ff]/20 ${meta.iconClass}`}
        >
          <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-900">{data.name}</p>
          <p className="text-[9px] text-slate-400">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="rounded bg-[#b1b2ff]/10 px-2 py-0.5 text-[10px] font-medium text-[#6d6fd8]">
          {data.type}
        </span>
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          {data.country || "Unassigned"}
        </span>
        {data.imported && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            Imported
          </span>
        )}
        {data.risk_probability && data.risk_probability !== "Low" && (
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
              data.risk_probability === "Critical"
                ? "bg-red-100 text-red-700"
                : data.risk_probability === "High"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {data.risk_probability}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-600">Risk {data.risk_score ?? 0}%</span>
        {data.external_risk_score > 0 && (
          <span className="text-[9px] font-medium text-red-400" title="External disruption risk">
            ⚡ {data.external_risk_score}%
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-[#b1b2ff]" />
    </div>
  );
}

export default CustomNode;
