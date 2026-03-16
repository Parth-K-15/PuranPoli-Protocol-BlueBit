import { useState, useEffect } from "react";
import { graphApi, workspaceApi } from "../services/api";

const severityLabel = (score) => {
  if (score >= 80) return { text: "Critical", cls: "bg-red-100 text-red-700" };
  if (score >= 60) return { text: "High", cls: "bg-orange-100 text-orange-700" };
  if (score >= 40) return { text: "Moderate", cls: "bg-yellow-100 text-yellow-700" };
  return { text: "Low", cls: "bg-green-100 text-green-700" };
};

const riskColor = (prob) => {
  if (prob === "Critical") return "text-red-600";
  if (prob === "High") return "text-orange-600";
  if (prob === "Moderate") return "text-yellow-600";
  return "text-green-600";
};

const OWM_ICON = (code) =>
  code ? `https://openweathermap.org/img/wn/${code}@2x.png` : null;

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
  { key: "gmp_status", label: "GMP Status", type: "select", options: ["Certified", "Pending", "Non-Compliant", "Unknown"] },
  { key: "fda_approval", label: "FDA Approval", type: "select", options: ["Approved", "Pending", "Not Required", "Rejected", "Unknown"] },
  { key: "cold_chain_capable", label: "Cold Chain Capable", type: "checkbox" },
  { key: "cost", label: "Cost ($)", type: "number" },
  { key: "moq", label: "MOQ", type: "number" },
  { key: "contract_duration_months", label: "Contract Duration (months)", type: "number" },
  { key: "batch_cycle_time_days", label: "Batch Cycle Time (days)", type: "number" },
  { key: "financial_health_score", label: "Financial Health (0-100)", type: "number" },
];

function NodeDetailsPanel({
  node,
  onClose,
  onSave,
  onDelete,
  isSaving,
  workspaceId,
  onNetworkChange,
}) {
  const [formState, setFormState] = useState(node?.data || {});
  const [intel, setIntel] = useState(null);
  const [loadingIntel, setLoadingIntel] = useState(false);
  const [networkBusy, setNetworkBusy] = useState(false);
  const [networkExpanded, setNetworkExpanded] = useState(false);
  const linkedWorkspaceId =
    formState.linkedWorkspace || node?.data?.linkedWorkspace || null;
  const anchorNodeId = node?.id || null;
  const canToggleNetwork = Boolean(workspaceId && linkedWorkspaceId && anchorNodeId);

  useEffect(() => {
    if (!node?.data?.id) return;
    setLoadingIntel(true);
    graphApi
      .getNodeIntelligence(node.data.id)
      .then((res) => setIntel(res))
      .catch(() => setIntel(null))
      .finally(() => setLoadingIntel(false));
  }, [node?.data?.id]);

  useEffect(() => {
    if (!canToggleNetwork) {
      setNetworkExpanded(false);
      return;
    }

    let active = true;

    const syncExpandedState = async () => {
      try {
        const graph = await graphApi.getGraph(workspaceId);
        const graphNodes = graph?.nodes || [];
        const graphEdges = graph?.edges || [];

        const importedNodeIds = new Set(
          graphNodes
            .filter((graphNode) => {
              const isImported = Boolean(graphNode?.data?.imported);
              const sourceWorkspace = String(graphNode?.data?.sourceWorkspace || "");
              return isImported && sourceWorkspace === String(linkedWorkspaceId);
            })
            .map((graphNode) => graphNode.id)
        );

        const expanded = graphEdges.some(
          (graphEdge) =>
            graphEdge?.source === anchorNodeId && importedNodeIds.has(graphEdge?.target)
        );

        if (active) {
          setNetworkExpanded(expanded);
        }
      } catch {
        if (active) {
          setNetworkExpanded(false);
        }
      }
    };

    syncExpandedState();

    return () => {
      active = false;
    };
  }, [canToggleNetwork, workspaceId, linkedWorkspaceId, anchorNodeId]);

  if (!node) {
    return null;
  }

  const disruptions = intel?.disruptions || [];
  const weather = intel?.weather || null;
  const news = intel?.news || { positive: [], negative: [], neutral: [] };
  const risk = intel?.risk || null;

  const handleChange = (key, value, type) => {
    setFormState((prev) => ({
      ...prev,
      [key]: type === "number" ? Number(value) : type === "checkbox" ? Boolean(value) : value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave(node.id, formState);
  };

  const handleToggleSupplierNetwork = async () => {
    if (!canToggleNetwork) return;

    setNetworkBusy(true);
    try {
      const collapseResult = await workspaceApi.collapseSupplierNetwork(workspaceId, {
        anchorNodeId,
        sourceWorkspaceId: linkedWorkspaceId,
      });

      if (collapseResult?.collapsed) {
        setNetworkExpanded(false);
        onNetworkChange?.();
        return;
      }

      const viewResult = await workspaceApi.viewSupplierNetwork(workspaceId, {
          anchorNodeId,
          sourceWorkspaceId: linkedWorkspaceId,
        });

      if (viewResult?.success) {
        setNetworkExpanded(true);
        onNetworkChange?.();
      }
    } catch (error) {
      window.alert(error?.response?.data?.message || "Supplier network action failed");
    } finally {
      setNetworkBusy(false);
    }
  };

  const riskValue = Math.max(0, Math.min(100, Number(formState.risk_score || 0)));
  const circumference = 2 * Math.PI * 72;
  const dashOffset = circumference - (riskValue / 100) * circumference;

  return (
    <aside className="fixed inset-x-0 bottom-16 top-0 z-40 overflow-y-auto border-l border-[#b1b2ff]/10 bg-white p-4 sm:p-6 md:static md:inset-auto md:w-80">
      <div className="mb-8">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Node Inspector</h3>
          <button
            type="button"
            className="material-symbols-outlined text-slate-400 transition-colors hover:text-[#b1b2ff]"
            onClick={onClose}
          >
            close
          </button>
        </div>

        <div className="flex flex-col items-center justify-center border-b border-[#b1b2ff]/5 py-6">
          <div className="relative flex items-center justify-center">
            <svg className="h-40 w-40 -rotate-90">
              <circle cx="80" cy="80" r="72" fill="transparent" stroke="currentColor" strokeWidth="8" className="text-[#b1b2ff]/10" />
              <circle
                cx="80"
                cy="80"
                r="72"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                className={riskValue > 60 ? "text-red-500" : riskValue > 30 ? "text-yellow-500" : "text-[#b1b2ff]"}
                style={{
                  strokeDasharray: circumference,
                  strokeDashoffset: dashOffset,
                }}
              />
            </svg>

            <div className="absolute text-center">
              <span className="text-3xl font-black text-slate-900">{riskValue}%</span>
              <p className="text-[10px] font-bold uppercase text-slate-400">Risk Score</p>
            </div>
          </div>

          <div className="mt-4 flex gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">{formState.lead_time_days || 0}d</p>
              <p className="text-[8px] uppercase text-slate-400">Lead Time</p>
            </div>
            <div className="h-8 w-px bg-[#b1b2ff]/10" />
            <div>
              <p className="text-lg font-bold text-slate-900">{formState.capacity || 0}</p>
              <p className="text-[8px] uppercase text-slate-400">Capacity</p>
            </div>
          </div>

          {/* Risk Probability Badge */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              formState.risk_probability === "Critical" ? "bg-red-100 text-red-700"
                : formState.risk_probability === "High" ? "bg-orange-100 text-orange-700"
                : formState.risk_probability === "Moderate" ? "bg-yellow-100 text-yellow-700"
                : "bg-green-100 text-green-700"
            }`}>{formState.risk_probability || "Low"}</span>
            {(formState.external_risk_score || 0) > 0 && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold text-red-600">
                External: {formState.external_risk_score}%
              </span>
            )}
          </div>
        </div>

        {loadingIntel && (
          <div className="mt-4 flex items-center justify-center gap-2 py-6 text-[11px] text-slate-400">
            <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
            Loading intelligence data…
          </div>
        )}

        {/* ── Weather Card ── */}
        {weather && (
          <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase text-sky-700">
              <span className="material-symbols-outlined text-[14px]">cloud</span>
              Weather — {weather.city}, {weather.country}
            </h4>
            <div className="flex items-center gap-3">
              {weather.icon && <img src={OWM_ICON(weather.icon)} alt={weather.description} className="h-12 w-12" />}
              <div className="text-[11px]">
                <p className="text-lg font-black text-slate-900">{weather.temp}°C</p>
                <p className="capitalize text-slate-600">{weather.description}</p>
              </div>
              <div className="ml-auto space-y-0.5 text-right text-[10px] text-slate-500">
                <p>Feels like {weather.feels_like}°C</p>
                <p>Wind: {weather.wind_speed} m/s</p>
                <p>Humidity: {weather.humidity}%</p>
                {weather.rain_mm > 0 && <p>Rain: {weather.rain_mm}mm</p>}
              </div>
            </div>
            {(weather.wind_speed > 20 || weather.temp > 40 || weather.rain_mm > 50) && (
              <div className="mt-2 rounded bg-orange-100 px-2 py-1 text-[10px] font-medium text-orange-700">
                ⚠ Severe weather conditions may impact logistics
              </div>
            )}
          </div>
        )}

        {/* ── External Risk Explanation ── */}
        {risk && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <h4 className="mb-3 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            Risk Breakdown
          </h4>

          {/* Composite summary */}
          <div className="mb-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-white p-2">
              <p className="text-lg font-black text-slate-900">{risk.composite}%</p>
              <p className="text-[8px] font-bold uppercase text-slate-400">Composite Risk</p>
            </div>
            <div className="rounded-lg bg-white p-2">
              <p className={`text-lg font-black ${riskColor(risk.probability)}`}>
                {risk.probability}
              </p>
              <p className="text-[8px] font-bold uppercase text-slate-400">Probability</p>
            </div>
          </div>

          {/* Internal vs External bar */}
          <div className="space-y-2 text-[11px]">
            <div>
              <div className="mb-0.5 flex items-center justify-between">
                <span className="font-semibold text-slate-600">Internal Risk</span>
                <span className="font-bold text-indigo-600">{risk.internal_risk}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className="h-1.5 rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${risk.internal_risk}%` }}
                />
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">
                Reliability gap: {risk.factors.reliability_gap}% · Dependency: {risk.factors.dependency}% · Financial weakness: {risk.factors.financial_weakness}%
              </p>
            </div>
            <div>
              <div className="mb-0.5 flex items-center justify-between">
                <span className="font-semibold text-slate-600">External Risk</span>
                <span className="font-bold text-red-600">{risk.external_risk}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-200">
                <div
                  className="h-1.5 rounded-full bg-red-400 transition-all"
                  style={{ width: `${risk.external_risk}%` }}
                />
              </div>
              <p className="mt-0.5 text-[9px] text-slate-400">
                Based on {disruptions.length} disruption event{disruptions.length !== 1 ? "s" : ""} in {formState.country || "N/A"} (last 48h)
                {risk.disruption_risk != null && ` · News/events: ${risk.disruption_risk}%`}
                {risk.weather_severity > 0 && ` · Weather severity: ${risk.weather_severity}%`}
              </p>
            </div>
          </div>

          {/* Contributing factors */}
          <div className="mt-3 space-y-1 text-[10px]">
            <p className="font-bold uppercase text-slate-500">Contributing Factors</p>
            <div className="flex flex-wrap gap-1">
              {risk.factors.compliance === "Non-Compliant" && (
                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">Non-Compliant</span>
              )}
              {risk.factors.gmp === "Non-Compliant" && (
                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">GMP Non-Compliant</span>
              )}
              {risk.factors.gmp === "Pending" && (
                <span className="rounded bg-yellow-100 px-2 py-0.5 font-medium text-yellow-700">GMP Pending</span>
              )}
              {risk.factors.fda === "Rejected" && (
                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">FDA Rejected</span>
              )}
              {risk.factors.fda === "Pending" && (
                <span className="rounded bg-yellow-100 px-2 py-0.5 font-medium text-yellow-700">FDA Pending</span>
              )}
              {risk.factors.reliability_gap > 50 && (
                <span className="rounded bg-orange-100 px-2 py-0.5 font-medium text-orange-700">Low Reliability</span>
              )}
              {risk.factors.dependency > 70 && (
                <span className="rounded bg-orange-100 px-2 py-0.5 font-medium text-orange-700">High Dependency</span>
              )}
              {risk.factors.financial_weakness > 60 && (
                <span className="rounded bg-orange-100 px-2 py-0.5 font-medium text-orange-700">Weak Financials</span>
              )}
              {disruptions.length > 0 && (
                <span className="rounded bg-red-100 px-2 py-0.5 font-medium text-red-700">{disruptions.length} Disruption{disruptions.length > 1 ? "s" : ""}</span>
              )}
              {risk.weather_severity > 0 && (
                <span className="rounded bg-sky-100 px-2 py-0.5 font-medium text-sky-700">Weather Risk: {risk.weather_severity}%</span>
              )}
              {disruptions.length === 0 && risk.factors.compliance !== "Non-Compliant" && risk.factors.reliability_gap <= 50 && risk.weather_severity === 0 && (
                <span className="rounded bg-green-100 px-2 py-0.5 font-medium text-green-700">No major factors</span>
              )}
            </div>
          </div>

          <p className="mt-2 text-[8px] text-slate-400">
            External = max(disruption severity, weather severity). Composite = 55% Internal + 45% External.
          </p>
          {formState.last_risk_update && (
            <p className="text-[9px] text-slate-400">
              Last computed: {new Date(formState.last_risk_update).toLocaleString()}
            </p>
          )}
        </div>
        )}

        {/* ── Active Disruptions Detail ── */}
        {disruptions.length > 0 && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase text-red-600">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              Active Disruptions ({disruptions.length})
            </h4>
            <div className="space-y-3">
              {disruptions.slice(0, 8).map((d, i) => {
                const sev = severityLabel(d.severity_score);
                return (
                  <div key={d._id || i} className="rounded-lg border border-red-100 bg-white p-3 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold capitalize text-slate-800">
                        {d.event_type?.replace(/_/g, " ")}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${sev.cls}`}>
                        {sev.text} ({d.severity_score})
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{d.description}</p>
                    <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] text-slate-400">
                      <span>{d.source_type}</span>
                      <span>·</span>
                      <span>{d.location}, {d.country}</span>
                      <span>·</span>
                      <span>{new Date(d.detected_at).toLocaleDateString()}</span>
                    </div>
                    {d.raw_source_url && (
                      <a
                        href={d.raw_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-[9px] font-medium text-[#6d6fd8] hover:underline"
                      >
                        View source article →
                      </a>
                    )}
                    {d.related_articles?.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-red-50 pt-2">
                        <p className="text-[9px] font-bold text-slate-500">Related Articles ({d.related_articles.length})</p>
                        {d.related_articles.slice(0, 3).map((art, j) => (
                          <div key={j} className="text-[9px]">
                            <a
                              href={art.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-[#6d6fd8] hover:underline"
                            >
                              {art.title}
                            </a>
                            <span className="ml-1 text-slate-400">{art.source}</span>
                            {art.matched_keywords?.length > 0 && (
                              <span className="ml-1 text-slate-400">— {art.matched_keywords.join(", ")}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {disruptions.length > 8 && (
                <p className="text-center text-[10px] text-red-400">+{disruptions.length - 8} more disruptions</p>
              )}
            </div>
          </div>
        )}

        {/* No disruptions message */}
        {!loadingIntel && disruptions.length === 0 && (
          <div className="mt-4 rounded-xl border border-green-100 bg-green-50/50 p-4 text-center">
            <span className="material-symbols-outlined text-[20px] text-green-600">verified</span>
            <p className="mt-1 text-[11px] font-medium text-green-700">No active external disruptions</p>
            <p className="text-[9px] text-green-500">No disruption events detected for {formState.country || "this region"} in the last 48 hours</p>
          </div>
        )}

        {/* ── Negative News (live feed) ── */}
        {news.negative.length > 0 && (
          <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase text-orange-700">
              <span className="material-symbols-outlined text-[14px]">trending_down</span>
              Negative Signals ({news.negative.length})
            </h4>
            <div className="space-y-2">
              {news.negative.slice(0, 5).map((n, i) => (
                <div key={i} className="rounded-lg bg-white p-2 text-[10px]">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 hover:text-[#6d6fd8]">{n.title}</a>
                  <div className="mt-0.5 flex items-center gap-2 text-[9px] text-slate-400">
                    <span>{n.source}</span>
                    <span className="rounded bg-red-100 px-1 py-0.5 text-red-600">sentiment: {n.sentiment}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Positive News ── */}
        {news.positive.length > 0 && (
          <div className="mt-4 rounded-xl border border-green-100 bg-green-50/50 p-4">
            <h4 className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase text-green-700">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              Positive Signals ({news.positive.length})
            </h4>
            <div className="space-y-2">
              {news.positive.slice(0, 5).map((n, i) => (
                <div key={i} className="rounded-lg bg-white p-2 text-[10px]">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-700 hover:text-[#6d6fd8]">{n.title}</a>
                  <div className="mt-0.5 flex items-center gap-2 text-[9px] text-slate-400">
                    <span>{n.source}</span>
                    <span className="rounded bg-green-100 px-1 py-0.5 text-green-600">sentiment: +{n.sentiment}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── No news ── */}
        {!loadingIntel && news.positive.length === 0 && news.negative.length === 0 && news.neutral.length === 0 && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center text-[10px] text-slate-400">
            No recent news found for {formState.country || "this region"}
          </div>
        )}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        {fields.map((field) => (
          <label key={field.key} className="block space-y-2">
            <span className="text-[10px] font-bold uppercase text-slate-400">{field.label}</span>

            {field.type === "select" ? (
              <select
                className="w-full rounded-xl border border-[#b1b2ff]/10 bg-[#b1b2ff]/5 px-4 py-3 text-sm font-medium focus:border-[#b1b2ff] focus:ring-1 focus:ring-[#b1b2ff]"
                value={formState[field.key] ?? ""}
                onChange={(event) => handleChange(field.key, event.target.value, "text")}
              >
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-[#b1b2ff]/20 text-[#b1b2ff] focus:ring-[#b1b2ff]"
                  checked={!!formState[field.key]}
                  onChange={(event) => handleChange(field.key, event.target.checked, "checkbox")}
                />
                <span className="text-sm text-slate-600">{formState[field.key] ? "Yes" : "No"}</span>
              </div>
            ) : (
              <input
                className="w-full rounded-xl border border-[#b1b2ff]/10 bg-[#b1b2ff]/5 px-4 py-3 text-sm font-medium focus:border-[#b1b2ff] focus:ring-1 focus:ring-[#b1b2ff]"
                type={field.type}
                value={formState[field.key] ?? ""}
                disabled={field.disabled}
                onChange={(event) => handleChange(field.key, event.target.value, field.type)}
              />
            )}
          </label>
        ))}

        {canToggleNetwork && (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#b1b2ff]/30 bg-[#b1b2ff]/10 py-2.5 text-xs font-bold text-[#4f52c9] transition-colors hover:bg-[#b1b2ff]/20 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleToggleSupplierNetwork}
            disabled={networkBusy}
          >
            <span className="material-symbols-outlined text-[16px]">
              {networkExpanded ? "unfold_less" : "account_tree"}
            </span>
            {networkBusy
              ? "Processing..."
              : networkExpanded
                ? "Collapse Network"
                : "View Network"}
          </button>
        )}

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
