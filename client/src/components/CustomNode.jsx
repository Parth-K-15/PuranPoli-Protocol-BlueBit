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

const riskClass = (riskScore = 0) => {
  if (riskScore <= 30) {
    return "ring-2 ring-green-400";
  }

  if (riskScore <= 60) {
    return "ring-2 ring-yellow-400";
  }

  if (riskScore <= 80) {
    return "ring-2 ring-orange-400";
  }

  return "ring-2 ring-red-500";
};

function CustomNode({ data }) {
  const typeClass = typeStyles[data.type] || "border-slate-300 bg-white text-slate-900";
  const meta = NODE_META[data.type] || {
    icon: "hub",
    title: data.type,
    subtitle: "Supply Entity",
    iconClass: "bg-slate-200 text-slate-700",
  };

  return (
    <div
      className={`w-52 cursor-move rounded-2xl border-2 p-4 shadow-2xl shadow-[#a390f9]/10 transition-all ${typeClass} ${riskClass(data.risk_score)}`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-[#a390f9]" />

      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-lg shadow-[#a390f9]/20 ${meta.iconClass}`}
        >
          <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-900">{data.name}</p>
          <p className="text-[9px] text-slate-400">{meta.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-medium text-[#6f59d9]">
          {data.type}
        </span>
        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
          {data.country || "Unassigned"}
        </span>
      </div>

      <div className="mt-2 text-[10px] font-semibold text-slate-600">Risk {data.risk_score ?? 0}%</div>

      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-[#a390f9]" />
    </div>
  );
}

export default CustomNode;
