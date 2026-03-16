function MarketplaceCard({ workspace, onClick }) {
  const {
    name,
    publisherName,
    description,
    tags = [],
    nodeCount = 0,
    edgeCount = 0,
    importCount = 0,
    countries = [],
    publishedAt,
  } = workspace;

  const countrySummary =
    countries.length <= 2
      ? countries.join(", ")
      : `${countries.slice(0, 2).join(", ")} +${countries.length - 2}`;

  const timeAgo = publishedAt
    ? new Date(publishedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      className="group flex cursor-pointer flex-col rounded-2xl border border-[#b1b2ff]/10 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:shadow-[#b1b2ff]/10 hover:border-[#b1b2ff]/30"
      onClick={() => onClick?.(workspace)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.(workspace);
      }}
    >
      {/* Header */}
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#6d6fd8] transition-colors">
          {name}
        </h3>
        <p className="text-xs text-slate-500">{publisherName || "Unknown publisher"}</p>
      </div>

      {/* Description */}
      <p className="mb-3 text-xs leading-relaxed text-slate-600 line-clamp-2">
        {description || "No description provided."}
      </p>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[#b1b2ff]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#6d6fd8]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="mt-auto" />

      {/* Stats row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600">
          <span className="material-symbols-outlined text-[12px]">hub</span>
          {nodeCount}N / {edgeCount}E
        </span>

        {importCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
            <span className="material-symbols-outlined text-[12px]">download</span>
            Imported {importCount} {importCount === 1 ? "time" : "times"}
          </span>
        )}

        {countrySummary && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-700">
            <span className="material-symbols-outlined text-[12px]">public</span>
            {countrySummary}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        {timeAgo && (
          <span className="text-[10px] text-slate-400">Published {timeAgo}</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#6d6fd8] opacity-0 transition-opacity group-hover:opacity-100">
          View Details
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </span>
      </div>
    </div>
  );
}

export default MarketplaceCard;
