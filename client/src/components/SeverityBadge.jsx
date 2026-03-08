const SEVERITY_CONFIG = {
  critical: { min: 80, bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", label: "Critical" },
  high:     { min: 60, bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", label: "High" },
  moderate: { min: 30, bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", label: "Moderate" },
  low:      { min: 0,  bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30", label: "Low" },
};

export function severityLevel(score) {
  if (score >= 80) return SEVERITY_CONFIG.critical;
  if (score >= 60) return SEVERITY_CONFIG.high;
  if (score >= 30) return SEVERITY_CONFIG.moderate;
  return SEVERITY_CONFIG.low;
}

export default function SeverityBadge({ score }) {
  const cfg = severityLevel(score);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.text.replace("text-", "bg-")}`} />
      {cfg.label} · {score}
    </span>
  );
}
