import { useEffect, useState, useRef } from "react";
import { graphApi, catalogApi } from "../services/api";
import { NODE_META, NODE_TYPES } from "../constants/nodeMeta";

const CATALOG_FIELDS = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "type", label: "Type", type: "select", options: NODE_TYPES, required: true },
  { key: "country", label: "Country", type: "text" },
  { key: "region", label: "Region", type: "text" },
  { key: "capacity", label: "Capacity", type: "number" },
  { key: "inventory", label: "Inventory", type: "number" },
  { key: "risk_score", label: "Risk Score (0-100)", type: "number" },
  { key: "lead_time_days", label: "Lead Time (days)", type: "number" },
  { key: "reliability_score", label: "Reliability (0-100)", type: "number" },
  { key: "dependency_percentage", label: "Dependency %", type: "number" },
  { key: "compliance_status", label: "Compliance", type: "select", options: ["Compliant", "Watchlist", "Non-Compliant", "Unknown"] },
  { key: "gmp_status", label: "GMP Status", type: "select", options: ["Certified", "Pending", "Non-Compliant", "Unknown"] },
  { key: "fda_approval", label: "FDA Approval", type: "select", options: ["Approved", "Pending", "Not Required", "Rejected", "Unknown"] },
  { key: "cold_chain_capable", label: "Cold Chain", type: "checkbox" },
  { key: "cost", label: "Cost ($)", type: "number" },
  { key: "moq", label: "MOQ", type: "number" },
  { key: "contract_duration_months", label: "Contract (months)", type: "number" },
  { key: "batch_cycle_time_days", label: "Batch Cycle (days)", type: "number" },
  { key: "financial_health_score", label: "Financial Health (0-100)", type: "number" },
];

const blankCatalogItem = () => ({
  name: "",
  type: NODE_TYPES[0],
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
});

const riskColor = (s) =>
  s <= 30 ? "text-emerald-600 bg-emerald-50" : s <= 60 ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";

function DataManagementPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("catalog");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const [editingItem, setEditingItem] = useState(null); // null = closed, {} = new, {catalogId:...} = editing
  const [formState, setFormState] = useState(blankCatalogItem());
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  // ── Load graph data ───────────────────────────────────────────────────────
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await graphApi.getGraph();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    } catch (error) {
      console.error("Failed to load graph", error);
    } finally {
      setLoading(false);
    }
  };

  // ── Load catalog data ─────────────────────────────────────────────────────
  const loadCatalog = async () => {
    try {
      const res = await catalogApi.list(typeFilter || undefined, searchQuery || undefined);
      const flat = [];
      for (const items of Object.values(res.catalog || {})) {
        flat.push(...items);
      }
      setCatalogItems(flat);
      setCatalogTotal(res.total ?? flat.length);
    } catch (error) {
      console.error("Failed to load catalog", error);
    }
  };

  useEffect(() => {
    loadData();
    loadCatalog();
  }, []);

  useEffect(() => {
    if (activeTab === "catalog") loadCatalog();
  }, [typeFilter, searchQuery, activeTab]);

  // ── Node / Edge handlers ──────────────────────────────────────────────────
  const handleDeleteNode = async (id) => {
    try {
      await graphApi.deleteNode(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Failed to delete node", error);
    }
  };

  const handleDeleteEdge = async (id) => {
    try {
      await graphApi.deleteEdge(id);
      setEdges((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      console.error("Failed to delete edge", error);
    }
  };

  const handleLoadDemo = async () => {
    try {
      await graphApi.loadDemo();
      await loadData();
    } catch (error) {
      console.error("Failed to load demo", error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all data? This cannot be undone.")) return;
    try {
      await graphApi.resetGraph();
      await loadData();
    } catch (error) {
      console.error("Failed to reset", error);
    }
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.nodes || !Array.isArray(data.nodes)) {
        setImportStatus({ type: "error", message: "Invalid format: must contain a 'nodes' array" });
        return;
      }

      let created = 0;
      for (const nodeData of data.nodes) {
        if (!nodeData.name || !nodeData.type || !NODE_TYPES.includes(nodeData.type)) continue;
        try {
          await graphApi.createNode({
            id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            ...nodeData,
            position: nodeData.position || { x: Math.random() * 800, y: Math.random() * 600 },
          });
          created++;
        } catch {
          // skip duplicates
        }
      }

      setImportStatus({ type: "success", message: `Imported ${created} nodes successfully` });
      await loadData();
    } catch {
      setImportStatus({ type: "error", message: "Failed to parse JSON file" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Catalog CRUD handlers ─────────────────────────────────────────────────
  const handleSeedCatalog = async () => {
    try {
      const res = await catalogApi.seed();
      setImportStatus({ type: "success", message: res.message });
      await loadCatalog();
    } catch (error) {
      console.error("Failed to seed catalog", error);
    }
  };

  const openCreateForm = () => {
    setEditingItem({});
    setFormState(blankCatalogItem());
  };

  const openEditForm = (item) => {
    setEditingItem(item);
    const state = {};
    for (const f of CATALOG_FIELDS) {
      state[f.key] = item[f.key] ?? blankCatalogItem()[f.key];
    }
    setFormState(state);
  };

  const closeForm = () => {
    setEditingItem(null);
  };

  const handleFormChange = (key, value, type) => {
    setFormState((prev) => ({
      ...prev,
      [key]: type === "number" ? Number(value) : type === "checkbox" ? Boolean(value) : value,
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingItem.catalogId) {
        await catalogApi.update(editingItem.catalogId, formState);
      } else {
        await catalogApi.create(formState);
      }
      closeForm();
      await loadCatalog();
    } catch (error) {
      console.error("Failed to save catalog item", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCatalogItem = async (catalogId) => {
    if (!window.confirm("Delete this catalog entry?")) return;
    try {
      await catalogApi.delete(catalogId);
      setCatalogItems((prev) => prev.filter((i) => i.catalogId !== catalogId));
    } catch (error) {
      console.error("Failed to delete catalog item", error);
    }
  };

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredNodes = nodes.filter((n) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (n.data?.name || "").toLowerCase().includes(q) ||
      (n.data?.type || "").toLowerCase().includes(q) ||
      (n.data?.country || "").toLowerCase().includes(q)
    );
  });

  const filteredEdges = edges.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.id || "").toLowerCase().includes(q) ||
      (e.source || "").toLowerCase().includes(q) ||
      (e.target || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#a390f9]">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Data Management</h1>
          <p className="text-sm text-slate-500">Manage entity catalog, supply chain nodes, and edges</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "catalog" && (
            <>
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl border border-[#a390f9]/30 bg-white px-4 py-2 text-xs font-bold text-[#6f59d9] hover:bg-[#a390f9]/5"
                onClick={handleSeedCatalog}
              >
                <span className="material-symbols-outlined text-[16px]">database</span>
                Seed Catalog
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl bg-[#a390f9] px-4 py-2 text-xs font-bold text-white hover:bg-[#8f79f7]"
                onClick={openCreateForm}
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                New Entity
              </button>
            </>
          )}
          {activeTab !== "catalog" && (
            <>
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl border border-[#a390f9]/30 bg-white px-4 py-2 text-xs font-bold text-[#6f59d9] hover:bg-[#a390f9]/5"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="material-symbols-outlined text-[16px]">upload</span>
                Import JSON
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl bg-[#a390f9] px-4 py-2 text-xs font-bold text-white hover:bg-[#8f79f7]"
                onClick={handleLoadDemo}
              >
                <span className="material-symbols-outlined text-[16px]">science</span>
                Load Demo
              </button>
              <button
                type="button"
                className="flex items-center gap-1 rounded-xl bg-red-50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-100"
                onClick={handleClearAll}
              >
                <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
                Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Import status */}
      {importStatus && (
        <div className={`flex items-center gap-2 rounded-xl p-4 text-sm font-medium ${
          importStatus.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
        }`}>
          <span className="material-symbols-outlined text-[18px]">
            {importStatus.type === "success" ? "check_circle" : "error"}
          </span>
          {importStatus.message}
          <button type="button" className="ml-auto text-xs" onClick={() => setImportStatus(null)}>Dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{catalogTotal}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Catalog Entities</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{nodes.length}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Graph Nodes</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{edges.length}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Graph Edges</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{new Set(catalogItems.map((i) => i.type)).size || new Set(nodes.map((n) => n.data?.type)).size}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Types</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{new Set(catalogItems.map((i) => i.country).filter(Boolean)).size || new Set(nodes.map((n) => n.data?.country).filter(Boolean)).size}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Countries</p>
        </div>
      </div>

      {/* Tab bar + search + type filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-xl border border-[#a390f9]/10 bg-white p-1">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${activeTab === "catalog" ? "bg-[#a390f9] text-white" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("catalog")}
          >
            Catalog ({catalogTotal})
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${activeTab === "nodes" ? "bg-[#a390f9] text-white" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("nodes")}
          >
            Nodes ({nodes.length})
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${activeTab === "edges" ? "bg-[#a390f9] text-white" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("edges")}
          >
            Edges ({edges.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "catalog" && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-[#a390f9]/10 bg-white py-2 px-3 text-xs font-medium focus:border-[#a390f9] focus:ring-1 focus:ring-[#a390f9]"
            >
              <option value="">All Types</option>
              {NODE_TYPES.map((t) => (
                <option key={t} value={t}>{NODE_META[t]?.title || t}</option>
              ))}
            </select>
          )}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-[#a390f9]/10 bg-white py-2 pl-10 pr-4 text-sm focus:border-[#a390f9] focus:ring-1 focus:ring-[#a390f9]"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white shadow-sm">
        {/* ─── Catalog Tab ─────────────────────────────────────────────────── */}
        {activeTab === "catalog" && (
          <div>
            {catalogItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <span className="material-symbols-outlined text-5xl text-slate-300">inventory_2</span>
                <p className="text-sm text-slate-400">No catalog entities yet.</p>
                <button
                  type="button"
                  className="mt-2 rounded-xl bg-[#a390f9] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#8f79f7]"
                  onClick={handleSeedCatalog}
                >
                  Seed Default Catalog
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {catalogItems.map((item) => {
                  const meta = NODE_META[item.type] || { title: item.type, icon: "hub", iconClass: "bg-slate-200 text-slate-700" };
                  return (
                    <div key={item.catalogId} className="group flex items-start gap-4 px-6 py-4 transition-colors hover:bg-slate-50/60">
                      {/* Icon */}
                      <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.iconClass}`}>
                        <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
                      </div>

                      {/* Info grid */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-bold text-slate-900">{item.name}</p>
                          <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-medium text-[#6f59d9]">{meta.title}</span>
                        </div>

                        {/* Badges row */}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            <span className="material-symbols-outlined text-[11px]">location_on</span>{item.country || "—"}
                          </span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${riskColor(item.risk_score)}`}>
                            Risk {item.risk_score}%
                          </span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            item.gmp_status === "Certified" ? "bg-green-50 text-green-700" : item.gmp_status === "Pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>GMP: {item.gmp_status}</span>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            item.fda_approval === "Approved" ? "bg-green-50 text-green-700" : item.fda_approval === "Pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>FDA: {item.fda_approval}</span>
                          {item.cold_chain_capable && (
                            <span className="rounded bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700">Cold Chain</span>
                          )}
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            item.compliance_status === "Compliant" ? "bg-green-100 text-green-700"
                              : item.compliance_status === "Non-Compliant" ? "bg-red-100 text-red-700"
                              : item.compliance_status === "Watchlist" ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-500"
                          }`}>{item.compliance_status}</span>
                        </div>

                        {/* Detail grid */}
                        <div className="mt-2 grid grid-cols-3 gap-x-6 gap-y-1 text-[11px] sm:grid-cols-6">
                          <CatalogDetail label="Region" value={item.region} />
                          <CatalogDetail label="Capacity" value={item.capacity?.toLocaleString()} />
                          <CatalogDetail label="Inventory" value={item.inventory?.toLocaleString()} />
                          <CatalogDetail label="Lead Time" value={`${item.lead_time_days}d`} />
                          <CatalogDetail label="Reliability" value={`${item.reliability_score}%`} />
                          <CatalogDetail label="Dependency" value={`${item.dependency_percentage}%`} />
                          <CatalogDetail label="Cost" value={`$${item.cost?.toLocaleString()}`} />
                          <CatalogDetail label="MOQ" value={item.moq?.toLocaleString()} />
                          <CatalogDetail label="Contract" value={`${item.contract_duration_months}mo`} />
                          <CatalogDetail label="Batch Cycle" value={`${item.batch_cycle_time_days}d`} />
                          <CatalogDetail label="Financial" value={`${item.financial_health_score}%`} />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-[#a390f9]/10 hover:text-[#6f59d9]"
                          onClick={() => openEditForm(item)}
                          title="Edit"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleDeleteCatalogItem(item.catalogId)}
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Nodes Tab ───────────────────────────────────────────────────── */}
        {activeTab === "nodes" && (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Country</th>
                  <th className="pb-3 pr-4">Risk</th>
                  <th className="pb-3 pr-4">Capacity</th>
                  <th className="pb-3 pr-4">Compliance</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredNodes.map((node) => (
                  <tr key={node.id} className="text-slate-700 transition-colors hover:bg-slate-50/50">
                    <td className="py-3 pr-4 font-medium">{node.data?.name}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-medium text-[#6f59d9]">{node.data?.type}</span>
                    </td>
                    <td className="py-3 pr-4">{node.data?.country || "—"}</td>
                    <td className="py-3 pr-4 text-xs font-bold">{node.data?.risk_score}%</td>
                    <td className="py-3 pr-4 text-xs">{node.data?.capacity || "—"}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        node.data?.compliance_status === "Compliant" ? "bg-green-100 text-green-700"
                          : node.data?.compliance_status === "Non-Compliant" ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-500"
                      }`}>{node.data?.compliance_status || "Unknown"}</span>
                    </td>
                    <td className="py-3">
                      <button type="button" className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteNode(node.id)} title="Delete node">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredNodes.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-slate-400">No nodes found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Edges Tab ───────────────────────────────────────────────────── */}
        {activeTab === "edges" && (
          <div className="overflow-x-auto p-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <th className="pb-3 pr-4">Edge ID</th>
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">Target</th>
                  <th className="pb-3 pr-4">Relationship</th>
                  <th className="pb-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredEdges.map((edge) => {
                  const sourceNode = nodes.find((n) => n.id === edge.source);
                  const targetNode = nodes.find((n) => n.id === edge.target);
                  return (
                    <tr key={edge.id} className="text-slate-700 transition-colors hover:bg-slate-50/50">
                      <td className="py-3 pr-4 font-mono text-xs">{edge.id}</td>
                      <td className="py-3 pr-4 text-xs font-medium">{sourceNode?.data?.name || edge.source}</td>
                      <td className="py-3 pr-4 text-xs font-medium">{targetNode?.data?.name || edge.target}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-bold text-[#6f59d9]">{edge.label || "—"}</span>
                      </td>
                      <td className="py-3">
                        <button type="button" className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteEdge(edge.id)} title="Delete edge">
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredEdges.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-sm text-slate-400">No edges found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Edit / Create Modal ────────────────────────────────────────────── */}
      {editingItem !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={closeForm}>
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-[#a390f9]/20 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-[#a390f9]/10 px-6 py-4">
              <h2 className="text-base font-bold text-slate-900">{editingItem.catalogId ? "Edit Entity" : "Create New Entity"}</h2>
              <button type="button" className="material-symbols-outlined text-slate-400 hover:text-slate-600" onClick={closeForm}>close</button>
            </div>

            {/* Modal body */}
            <form className="flex-1 overflow-y-auto px-6 py-4" onSubmit={handleFormSubmit}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {CATALOG_FIELDS.map((field) => (
                  <label key={field.key} className={`block space-y-1 ${field.key === "name" ? "sm:col-span-2" : ""}`}>
                    <span className="text-[10px] font-bold uppercase text-slate-400">{field.label}</span>

                    {field.type === "select" ? (
                      <select
                        className="w-full rounded-xl border border-[#a390f9]/10 bg-[#a390f9]/5 px-3 py-2.5 text-sm font-medium focus:border-[#a390f9] focus:ring-1 focus:ring-[#a390f9]"
                        value={formState[field.key] ?? ""}
                        onChange={(e) => handleFormChange(field.key, e.target.value, "text")}
                        required={field.required}
                        disabled={field.key === "type" && !!editingItem.catalogId}
                      >
                        {field.options.map((opt) => (
                          <option key={opt} value={opt}>{NODE_META[opt]?.title || opt}</option>
                        ))}
                      </select>
                    ) : field.type === "checkbox" ? (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-[#a390f9]/20 text-[#a390f9] focus:ring-[#a390f9]"
                          checked={!!formState[field.key]}
                          onChange={(e) => handleFormChange(field.key, e.target.checked, "checkbox")}
                        />
                        <span className="text-sm text-slate-600">{formState[field.key] ? "Yes" : "No"}</span>
                      </div>
                    ) : (
                      <input
                        className="w-full rounded-xl border border-[#a390f9]/10 bg-[#a390f9]/5 px-3 py-2.5 text-sm font-medium focus:border-[#a390f9] focus:ring-1 focus:ring-[#a390f9]"
                        type={field.type}
                        value={formState[field.key] ?? ""}
                        onChange={(e) => handleFormChange(field.key, e.target.value, field.type)}
                        required={field.required}
                      />
                    )}
                  </label>
                ))}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button type="button" className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50" onClick={closeForm}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#a390f9] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#8f79f7] disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingItem.catalogId ? "Update Entity" : "Create Entity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogDetail({ label, value }) {
  return (
    <div>
      <span className="font-bold uppercase text-slate-400">{label}</span>
      <p className="font-semibold text-slate-700">{value || "—"}</p>
    </div>
  );
}

export default DataManagementPage;
