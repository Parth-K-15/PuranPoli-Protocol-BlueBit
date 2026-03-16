import { useEffect, useState } from "react";
import { NODE_META } from "../constants/nodeMeta";
import { graphApi } from "../services/api";

function NodeCatalogModal({
  nodeType,
  position,
  existingNodes = [],
  onSelect,
  onClose,
}) {
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("catalog");

  const meta =
    NODE_META[nodeType] || {
      title: nodeType,
      subtitle: "",
      icon: "hub",
      iconClass: "bg-slate-100 text-slate-700",
    };

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      setLoading(true);
      try {
        const res = await graphApi.getNodeCatalog(nodeType);
        if (!cancelled) {
          setCatalog(res.catalog?.[nodeType] || []);
          setSource(res.source || "catalog");
        }
      } catch {
        if (!cancelled) {
          setCatalog([]);
          setSource("catalog");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [nodeType]);

  const workspaceItems = existingNodes
    .filter((node) => node?.data?.type === nodeType)
    .map((node) => ({
      catalogId: `workspace_${node.id}`,
      name: node.data?.name || node.data?.label || node.id,
      country: node.data?.country || "",
      region: node.data?.region || "",
      type: nodeType,
      __fromWorkspace: true,
    }));

  const searchableText = (item) =>
    `${item.name || ""} ${item.country || ""} ${item.region || ""}`.toLowerCase();

  const filteredWorkspace = workspaceItems.filter((item) =>
    searchableText(item).includes(search.toLowerCase())
  );

  const filteredCatalog = catalog.filter((item) =>
    searchableText(item).includes(search.toLowerCase())
  );

  const handleSelect = (item) => {
    const {
      catalogId,
      _id,
      id,
      workspace,
      __v,
      createdAt,
      updatedAt,
      __fromWorkspace,
      ...rest
    } = item;

    onSelect({
      ...rest,
      type: nodeType,
      position,
    });
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

  const totalItems = filteredWorkspace.length + filteredCatalog.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mx-4 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#b1b2ff]/20 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 border-b border-slate-100 px-6 py-4">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${meta.iconClass}`}
          >
            <span className="material-symbols-outlined">{meta.icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-900">
              Select {meta.title}
            </h2>
            <p className="text-xs text-slate-500">
              Choose from the shared supplier catalog
              {source === "merged" ? " (catalog + supplier data)" : ""}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-[#b1b2ff]/20 bg-[#b1b2ff]/5 px-3 py-2.5">
            <span className="material-symbols-outlined text-[18px] text-slate-400">
              search
            </span>
            <input
              className="w-full bg-transparent text-sm text-slate-700 placeholder-slate-400 outline-none"
              placeholder="Search by name, country, region..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-3xl text-[#6d6fd8]">
                progress_activity
              </span>
            </div>
          ) : totalItems === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              No matching entities found.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredWorkspace.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
                  Existing nodes in this workspace
                </div>
              )}

              {filteredWorkspace.map((item) => (
                <button
                  key={item.catalogId}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-left transition-all hover:bg-emerald-50"
                  onClick={() => handleSelect(item)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {item.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {[item.country, item.region].filter(Boolean).join(" • ") || "No location"}
                    </p>
                  </div>
                  <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Reuse
                  </span>
                </button>
              ))}

              {filteredCatalog.map((item) => (
                <button
                  key={item.catalogId}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:border-[#b1b2ff]/40 hover:bg-[#b1b2ff]/5"
                  onClick={() => handleSelect(item)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {item.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {[item.country, item.region].filter(Boolean).join(" • ") || "No location"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      Risk {item.risk_score ?? 0}%
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-[#6d6fd8]">
                      arrow_forward
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
          <p className="text-[11px] text-slate-500">{totalItems} entities</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-xl bg-[#6d6fd8] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#5b5dc0]"
              onClick={handleCreateBlank}
            >
              Create Blank Node
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NodeCatalogModal;
