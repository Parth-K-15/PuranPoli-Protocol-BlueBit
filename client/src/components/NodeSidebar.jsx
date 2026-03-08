import { NODE_META, NODE_TYPES } from "../constants/nodeMeta";

function NodeSidebar({ open = true, onToggle }) {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  if (!open) {
    return (
      <div className="flex w-8 flex-col items-center border-r border-[#a390f9]/10 bg-white pt-4">
        <button
          type="button"
          onClick={onToggle}
          title="Show Node Library"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-[#a390f9]/10 hover:text-[#a390f9]"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="flex w-72 flex-col gap-6 overflow-y-auto border-r border-[#a390f9]/10 bg-white p-6">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Node Library</h3>
          <button
            type="button"
            onClick={onToggle}
            title="Collapse Node Library"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {NODE_TYPES.map((type) => {
            const meta = NODE_META[type];

            return (
              <div
                key={type}
                className="group flex cursor-grab items-center gap-4 rounded-xl border border-[#b1b2ff]/5 bg-[#f8f6ff] p-3 transition-all hover:border-[#b1b2ff]/40 hover:bg-white hover:shadow-xl hover:shadow-[#b1b2ff]/5"
                draggable
                onDragStart={(event) => onDragStart(event, type)}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${meta.iconClass}`}>
                  <span className="material-symbols-outlined">{meta.icon}</span>
                </div>

                <div>
                  <p className="text-sm font-semibold">{meta.title}</p>
                  <p className="text-[10px] uppercase text-slate-500">{meta.subtitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-auto rounded-xl border border-[#b1b2ff]/10 bg-[#b1b2ff]/5 p-4">
        <p className="mb-2 text-xs font-medium text-[#b1b2ff]">Graph Optimization</p>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Auto-rebalance nodes based on real-time transit data from Tier 1 partners.
        </p>
        <button className="mt-3 w-full rounded-lg bg-[#b1b2ff] py-2 text-xs font-bold text-white transition-colors hover:bg-[#9798f0]">
          Run Analytics
        </button>
      </div>
    </aside>
  );
}

export default NodeSidebar;
