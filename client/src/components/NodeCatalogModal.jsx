import { useEffect, useState } from "react";
import { NODE_META } from "../constants/nodeMeta";
import { graphApi } from "../services/api";

const riskColor = (score) => {
  if (score <= 30) return "text-emerald-600 bg-emerald-50";
  if (score <= 60) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
};

function NodeCatalogModal({ nodeType, position, workspaceId, onSelect, onClose }) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  const meta = NODE_META[nodeType] || { title: nodeType, icon: "hub", iconClass: "bg-slate-200 text-slate-700" };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await graphApi.getNodeCatalog(nodeType);
        if (!cancelled) {
          setCatalog(res.catalog?.[nodeType] || []);
        }
      } catch (err) {
        console.error("Failed to load catalog", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [nodeType]);

  const filtered = catalog.filter((item) =>
    `${item.name} ${item.country} ${item.region}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (item) => {
    const { catalogId, ...data } = item;
    onSelect({ ...data, type: nodeType, position });
  };

  const handleCreateBlank = () => {
    onSelect({
      name: `New ${meta.title}`,
      type: nodeType,
      country: "",
      region: "",
      capacity: 0,
      inventory: 0,
      risk_score: 0,
      lead_time_days: 0,
      reliability_score: 0,
      dependency_percentage: 0,
      compliance_status: "Unknown",
      gmp_status: "Unknown",
      fda_approval: "Unknown",
      cold_chain_capable: false,
      cost: 0,
      moq: 0,
      contract_duration_months: 0,
      batch_cycle_time_days: 0,
      financial_health_score: 0,
      position,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-[#a390f9]/20 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[#a390f9]/10 px-6 py-4">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.iconClass}`}>
            <span className="material-symbols-outlined">{meta.icon}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-900">Select {meta.title}</h2>
            <p className="text-xs text-slate-400">Choose a pre-built entity or create a blank node</p>
          </div>
          <button type="button" className="material-symbols-outlined text-slate-400 hover:text-slate-600" onClick={onClose}>close</button>
        </div>

        {/* Search */}
        <div className="border-b border-[#a390f9]/5 px-6 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#a390f9]/10 bg-[#a390f9]/5 px-4 py-2.5">
            <span className="material-symbols-outlined text-lg text-slate-400">search</span>
            <input
              className="w-full bg-transparent text-sm placeholder-slate-400 outline-none"
              placeholder="Search by name, country, or region…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#a390f9] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No matching entities found.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((item) => {
                const isExpanded = expanded === item.catalogId;
                return (
                  <div
                    key={item.catalogId}
                    className="rounded-xl border border-[#a390f9]/10 bg-white transition-all hover:border-[#a390f9]/30 hover:shadow-lg hover:shadow-[#a390f9]/5"
                  >
                    {/* Summary row */}
                    <div
                      className="flex cursor-pointer items-center gap-4 px-4 py-3"
                      onClick={() => setExpanded(isExpanded ? null : item.catalogId)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            <span className="material-symbols-outlined text-[12px]">location_on</span>
                            {item.country}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${riskColor(item.risk_score)}`}>
                            Risk {item.risk_score}%
                          </span>
                          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                            {item.gmp_status}
                          </span>
                          {item.cold_chain_capable && (
                            <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-medium text-cyan-600">
                              Cold Chain
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={`material-symbols-outlined text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                        expand_more
                      </span>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-[#a390f9]/5 px-4 py-3">
                        <div className="grid grid-cols-3 gap-x-4 gap-y-2 text-[11px]">
                          <Detail label="Region" value={item.region} />
                          <Detail label="Capacity" value={item.capacity?.toLocaleString()} />
                          <Detail label="Inventory" value={item.inventory?.toLocaleString()} />
                          <Detail label="Lead Time" value={`${item.lead_time_days}d`} />
                          <Detail label="Reliability" value={`${item.reliability_score}%`} />
                          <Detail label="Dependency" value={`${item.dependency_percentage}%`} />
                          <Detail label="FDA Approval" value={item.fda_approval} />
                          <Detail label="Compliance" value={item.compliance_status} />
                          <Detail label="Financial Health" value={`${item.financial_health_score}%`} />
                          <Detail label="Cost" value={`$${item.cost?.toLocaleString()}`} />
                          <Detail label="MOQ" value={item.moq?.toLocaleString()} />
                          <Detail label="Contract" value={`${item.contract_duration_months}mo`} />
                          <Detail label="Batch Cycle" value={`${item.batch_cycle_time_days}d`} />
                        </div>

                        <button
                          type="button"
                          className="mt-3 w-full rounded-lg bg-[#a390f9] py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#8f79f7]"
                          onClick={() => handleSelect(item)}
                        >
                          Add to Graph
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#a390f9]/10 px-6 py-3">
          <p className="text-[11px] text-slate-400">{filtered.length} entities available</p>
          <button
            type="button"
            className="rounded-xl border border-[#a390f9]/20 px-4 py-2 text-xs font-bold text-[#6f59d9] transition-colors hover:bg-[#a390f9]/5"
            onClick={handleCreateBlank}
          >
            + Create Blank Node
          </button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <span className="font-bold uppercase text-slate-400">{label}</span>
      <p className="font-semibold text-slate-700">{value || "—"}</p>
    </div>
  );
}

export default NodeCatalogModal;
