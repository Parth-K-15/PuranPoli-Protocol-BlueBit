import { NODE_META, NODE_TYPES } from "../constants/nodeMeta";

function NodeSidebar() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="hidden w-72 flex-col gap-6 overflow-y-auto border-r border-[#a390f9]/10 bg-white p-6 xl:flex">
      <div>
        <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Node Library</h3>

        <div className="flex flex-col gap-3">
          {NODE_TYPES.map((type) => {
            const meta = NODE_META[type];

            return (
              <div
                key={type}
                className="group flex cursor-grab items-center gap-4 rounded-xl border border-[#a390f9]/5 bg-[#f6f5f8] p-3 transition-all hover:border-[#a390f9]/40 hover:bg-white hover:shadow-xl hover:shadow-[#a390f9]/5"
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

      <div className="mt-auto rounded-xl border border-[#a390f9]/10 bg-[#a390f9]/5 p-4">
        <p className="mb-2 text-xs font-medium text-[#a390f9]">Graph Optimization</p>
        <p className="text-[11px] leading-relaxed text-slate-500">
          Auto-rebalance nodes based on real-time transit data from Tier 1 partners.
        </p>
        <button className="mt-3 w-full rounded-lg bg-[#a390f9] py-2 text-xs font-bold text-white transition-colors hover:bg-[#8f79f7]">
          Run Analytics
        </button>
      </div>
    </aside>
  );
}

export default NodeSidebar;
