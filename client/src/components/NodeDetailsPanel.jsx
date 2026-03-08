import { useState } from "react";

const fields = [
  { key: "name", label: "Node Name", type: "text" },
  { key: "type", label: "Type", type: "text", disabled: true },
  { key: "country", label: "Country", type: "text" },
  { key: "region", label: "Region", type: "text" },
  { key: "capacity", label: "Capacity", type: "number" },
  { key: "inventory", label: "Inventory", type: "number" },
  { key: "risk_score", label: "Risk Score (0-100)", type: "number" },
  { key: "lead_time_days", label: "Lead Time (days)", type: "number" },
  { key: "reliability_score", label: "Reliability Score", type: "number" },
  { key: "dependency_percentage", label: "Dependency %", type: "number" },
  { key: "compliance_status", label: "Compliance Status", type: "text" },
];

function NodeDetailsPanel({ node, onClose, onSave, onDelete, isSaving }) {
  const [formState, setFormState] = useState(node?.data || {});

  if (!node) {
    return null;
  }

  const handleChange = (key, value, type) => {
    setFormState((prev) => ({
      ...prev,
      [key]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(node.id, formState);
  };

  const riskValue = Math.max(0, Math.min(100, Number(formState.risk_score || 0)));
  const circumference = 2 * Math.PI * 72;
  const dashOffset = circumference - (riskValue / 100) * circumference;

  return (
    <aside className="w-80 overflow-y-auto border-l border-[#a390f9]/10 bg-white p-6">
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Node Inspector</h3>
          <button
            type="button"
            className="material-symbols-outlined text-slate-400 transition-colors hover:text-[#a390f9]"
            onClick={onClose}
          >
            close
          </button>
        </div>

        <div className="flex flex-col items-center justify-center border-b border-[#a390f9]/5 py-6">
          <div className="relative flex items-center justify-center">
            <svg className="h-40 w-40 -rotate-90">
              <circle cx="80" cy="80" r="72" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-[#a390f9]/10" />
              <circle
                cx="80"
                cy="80"
                r="72"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                className="text-[#a390f9]"
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: dashOffset,
                }}
              />
            </svg>

            <div className="absolute text-center">
              <span className="text-3xl font-black text-slate-900">{riskValue}%</span>
              <p className="text-[10px] font-bold uppercase text-slate-400">Health Score</p>
            </div>
          </div>

          <div className="mt-4 flex gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{formState.lead_time_days || 0}d</p>
              <p className="text-[8px] uppercase text-slate-400">Lead Time</p>
            </div>
            <div className="h-8 w-px bg-[#a390f9]/10" />
            <div>
              <p className="text-lg font-bold text-slate-900">{formState.capacity || 0}</p>
              <p className="text-[8px] uppercase text-slate-400">Capacity</p>
            </div>
          </div>
        </div>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <label key={field.key} className="block space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">{field.label}</span>

            <input
              className="w-full rounded-xl border border-[#a390f9]/10 bg-[#a390f9]/5 px-4 py-3 text-sm font-medium focus:border-[#a390f9] focus:ring-1 focus:ring-[#a390f9]"
              type={field.type}
              value={formState[field.key] ?? ""}
              disabled={field.disabled}
              onChange={(event) => handleChange(field.key, event.target.value, field.type)}
            />
          </label>
        ))}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Node"}
          </button>

          <button
            type="button"
            className="rounded-xl bg-red-50 p-3 text-red-500 transition-colors hover:bg-red-100"
            onClick={() => onDelete(node.id)}
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
        </div>
      </form>
    </aside>
  );
}

export default NodeDetailsPanel;
