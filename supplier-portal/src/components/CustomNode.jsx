import { Handle, Position } from "@xyflow/react";
import { NODE_META } from "../constants/nodeMeta";

const FALLBACK_META = {
  title: "My Node",
  subtitle: "Supplier End Point",
  icon: "person_pin_circle",
  iconClass: "bg-blue-100 text-blue-600",
};

export default function CustomNode({ data }) {
  const meta = NODE_META[data.type] || FALLBACK_META;

  return (
    <div className="relative min-w-[160px] rounded-2xl border border-[#b1b2ff]/30 bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-[#6d6fd8] !border-2 !border-white"
      />

      <div className="flex items-center gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {meta.icon}
          </span>
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800">
            {data.label || data.name || meta.title}
          </p>
          <p className="truncate text-xs text-slate-400">{meta.subtitle}</p>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-[#b1b2ff] !border-2 !border-white"
      />
    </div>
  );
}
