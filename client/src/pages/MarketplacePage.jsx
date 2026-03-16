import { useCallback, useEffect, useState } from "react";
import { marketplaceApi } from "../services/api";
import MarketplaceCard from "../components/MarketplaceCard";
import ChainPreview from "../components/ChainPreview";
import ImportModal from "../components/ImportModal";

const PAGE_SIZE = 12;

function MarketplacePage() {
  // List state
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState([]);
  const [sort, setSort] = useState("newest"); // "newest" | "popular"

  // Detail modal state
  const [detailWorkspace, setDetailWorkspace] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMeta, setDetailMeta] = useState(null);
  const [previewNodes, setPreviewNodes] = useState([]);
  const [previewEdges, setPreviewEdges] = useState([]);

  // Import modal state
  const [importOpen, setImportOpen] = useState(false);

  // Fetch list
  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceApi.list({
        search: search || undefined,
        tags: tags.length > 0 ? tags.join(",") : undefined,
        sort,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.workspaces || res.items || []);
      setTotal(res.total ?? (res.workspaces || res.items || []).length);
    } catch (err) {
      console.error("Failed to fetch marketplace listings", err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search, tags, sort, page]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, tags, sort]);

  // Open detail modal
  const openDetail = useCallback(async (workspace) => {
    setDetailWorkspace(workspace);
    setDetailLoading(true);
    setDetailMeta(null);
    setPreviewNodes([]);
    setPreviewEdges([]);

    try {
      const [meta, preview] = await Promise.all([
        marketplaceApi.get(workspace._id),
        marketplaceApi.preview(workspace._id),
      ]);
      setDetailMeta(meta.workspace || meta);
      setPreviewNodes(preview.nodes || []);
      setPreviewEdges(preview.edges || []);
    } catch (err) {
      console.error("Failed to load workspace details", err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailWorkspace(null);
    setDetailMeta(null);
    setPreviewNodes([]);
    setPreviewEdges([]);
  }, []);

  // Tag management
  const handleTagKeyDown = (e) => {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/,/g, "");
      if (newTag && !tags.includes(newTag)) {
        setTags((prev) => [...prev, newTag]);
      }
      setTagInput("");
    }
    if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  const removeTag = (tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Compute detail statistics
  const detailData = detailMeta || detailWorkspace;
  const nodeTypeDist = {};
  if (previewNodes.length > 0) {
    previewNodes.forEach((n) => {
      const t = n.data?.type || "Unknown";
      nodeTypeDist[t] = (nodeTypeDist[t] || 0) + 1;
    });
  }
  const avgRisk =
    previewNodes.length > 0
      ? Math.round(
          previewNodes.reduce((sum, n) => sum + (n.data?.risk_score || 0), 0) /
            previewNodes.length
        )
      : 0;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Supply Chain Marketplace</h1>
        <p className="mt-1 text-sm text-slate-500">
          Browse and import published supply chains from suppliers
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search bar */}
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search supply chains..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#b1b2ff]/20 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition-colors focus:border-[#6d6fd8] focus:ring-2 focus:ring-[#a390f9]/20"
          />
        </div>

        {/* Sort toggle */}
        <div className="flex rounded-xl border border-[#b1b2ff]/20 bg-white p-1">
          <button
            type="button"
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              sort === "newest"
                ? "bg-[#6d6fd8] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setSort("newest")}
          >
            Newest
          </button>
          <button
            type="button"
            className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${
              sort === "popular"
                ? "bg-[#6d6fd8] text-white shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setSort("popular")}
          >
            Most Imported
          </button>
        </div>
      </div>

      {/* Tag filter */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#b1b2ff]/10 bg-white px-3 py-2">
        <span className="material-symbols-outlined text-[16px] text-slate-400">label</span>
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-[#b1b2ff]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#6d6fd8]"
          >
            {tag}
            <button
              type="button"
              className="ml-0.5 text-[#6d6fd8]/60 hover:text-[#6d6fd8]"
              onClick={() => removeTag(tag)}
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </span>
        ))}
        <input
          type="text"
          placeholder={tags.length === 0 ? "Filter by tags (type and press Enter)..." : "Add tag..."}
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={handleTagKeyDown}
          className="min-w-[120px] flex-1 bg-transparent text-xs text-slate-700 placeholder-slate-400 outline-none"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-4xl text-[#b1b2ff]">
              progress_activity
            </span>
            <p className="mt-2 text-sm text-slate-500">Loading marketplace...</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#b1b2ff]/10">
            <span className="material-symbols-outlined text-4xl text-[#b1b2ff]">storefront</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">No Supply Chains Found</h2>
          <p className="max-w-sm text-center text-sm text-slate-500">
            {search || tags.length > 0
              ? "Try adjusting your search or filters."
              : "No published supply chains are available yet."}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((ws) => (
            <MarketplaceCard key={ws._id} workspace={ws} onClick={openDetail} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) {
                acc.push("ellipsis-" + p);
              }
              acc.push(p);
              return acc;
            }, [])
            .map((item) =>
              typeof item === "string" ? (
                <span key={item} className="px-1 text-xs text-slate-400">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                    page === item
                      ? "bg-[#6d6fd8] text-white shadow-sm"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              )
            )}

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </button>
        </div>
      )}

      {/* ─── Detail Modal ──────────────────────────────────────────────── */}
      {detailWorkspace && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={closeDetail}
        >
          <div
            className="mx-4 flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-[#b1b2ff]/10 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-slate-900 truncate">
                  {detailData?.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Published by{" "}
                  <span className="font-semibold text-[#6d6fd8]">
                    {detailData?.publisherName || "Unknown"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={closeDetail}
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <span className="material-symbols-outlined animate-spin text-3xl text-[#b1b2ff]">
                      progress_activity
                    </span>
                    <p className="mt-2 text-sm text-slate-500">Loading details...</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-[#b1b2ff]/10 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Nodes
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {detailData?.nodeCount ?? previewNodes.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#b1b2ff]/10 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Edges
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {detailData?.edgeCount ?? previewEdges.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#b1b2ff]/10 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Imports
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {detailData?.importCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-xl border border-[#b1b2ff]/10 bg-slate-50/50 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Avg Risk
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">{avgRisk}%</p>
                    </div>
                  </div>

                  {/* Description */}
                  {detailData?.description && (
                    <div>
                      <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                        Description
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {detailData.description}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {(detailData?.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {detailData.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[#b1b2ff]/10 px-3 py-1 text-[11px] font-medium text-[#6d6fd8]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Countries */}
                  {(detailData?.countries || []).length > 0 && (
                    <div>
                      <h3 className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                        Countries
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {detailData.countries.map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              location_on
                            </span>
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Node type distribution */}
                  {Object.keys(nodeTypeDist).length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                        Node Type Distribution
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(nodeTypeDist)
                          .sort((a, b) => b[1] - a[1])
                          .map(([type, count]) => (
                            <span
                              key={type}
                              className="rounded-lg bg-[#b1b2ff]/10 px-2.5 py-1 text-[11px] font-medium text-[#6d6fd8]"
                            >
                              {type}{" "}
                              <span className="font-bold text-slate-700">{count}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Chain preview */}
                  {previewNodes.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                        Chain Preview
                      </h3>
                      <div className="h-[340px] w-full overflow-hidden rounded-xl border border-[#b1b2ff]/10">
                        <ChainPreview nodes={previewNodes} edges={previewEdges} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                onClick={closeDetail}
              >
                Close
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-[#6d6fd8] px-5 py-2 text-xs font-bold text-white hover:bg-[#5b5dc0] transition-colors disabled:opacity-40"
                disabled={detailLoading}
                onClick={() => setImportOpen(true)}
              >
                <span className="material-symbols-outlined text-[14px]">download</span>
                Import into my Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Import Modal ──────────────────────────────────────────────── */}
      {importOpen && detailWorkspace && (
        <ImportModal
          sourceWorkspaceId={detailWorkspace._id}
          sourceWorkspaceName={detailData?.name || detailWorkspace.name}
          sourceNodes={previewNodes}
          sourceEdges={previewEdges}
          onClose={() => setImportOpen(false)}
          onImportSuccess={() => {
            setImportOpen(false);
            closeDetail();
            fetchList();
          }}
        />
      )}
    </div>
  );
}

export default MarketplacePage;
