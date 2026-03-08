import { useEffect, useState, useRef } from "react";
import { graphApi } from "../services/api";
import { NODE_META, NODE_TYPES } from "../constants/nodeMeta";

function DataManagementPage() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("nodes");
  const [searchQuery, setSearchQuery] = useState("");
  const [importStatus, setImportStatus] = useState(null);
  const fileInputRef = useRef(null);

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

  useEffect(() => {
    loadData();
  }, []);

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
          <p className="text-sm text-slate-500">Import, export, and manage supply chain data</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded-xl border border-[#a390f9]/30 bg-white px-4 py-2 text-xs font-bold text-[#6f59d9] hover:bg-[#a390f9]/5"
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="material-symbols-outlined text-[16px]">upload</span>
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
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
          <button
            type="button"
            className="ml-auto text-xs"
            onClick={() => setImportStatus(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{nodes.length}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Nodes</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{edges.length}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Edges</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{new Set(nodes.map((n) => n.data?.type)).size}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Types</p>
        </div>
        <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-4 shadow-sm text-center">
          <p className="text-2xl font-black text-slate-900">{new Set(nodes.map((n) => n.data?.country).filter(Boolean)).size}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">Countries</p>
        </div>
      </div>

      {/* Tab bar + search */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-xl border border-[#a390f9]/10 bg-white p-1">
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "nodes" ? "bg-[#a390f9] text-white" : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("nodes")}
          >
            Nodes ({nodes.length})
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === "edges" ? "bg-[#a390f9] text-white" : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("edges")}
          >
            Edges ({edges.length})
          </button>
        </div>

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

      {/* Tables */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
        {activeTab === "nodes" && (
          <div className="overflow-x-auto">
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
                      <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-medium text-[#6f59d9]">
                        {node.data?.type}
                      </span>
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
                      <button
                        type="button"
                        className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleDeleteNode(node.id)}
                        title="Delete node"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredNodes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                      No nodes found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "edges" && (
          <div className="overflow-x-auto">
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
                        <span className="rounded bg-[#a390f9]/10 px-2 py-0.5 text-[10px] font-bold text-[#6f59d9]">
                          {edge.label || "—"}
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          className="rounded-lg p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleDeleteEdge(edge.id)}
                          title="Delete edge"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredEdges.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-slate-400">
                      No edges found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default DataManagementPage;
