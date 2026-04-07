import Skeleton from "react-loading-skeleton";

const DARK_BASE = "#1f2937";
const DARK_HIGHLIGHT = "#374151";
const LIGHT_BASE = "#e9e6ff";
const LIGHT_HIGHLIGHT = "#f4f2ff";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={320} height={28} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
          <Skeleton width={420} height={16} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
        </div>
        <Skeleton width={140} height={38} borderRadius={10} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`kpi-${index}`} className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <Skeleton width={130} height={16} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
            <div className="mt-3">
              <Skeleton width={80} height={30} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`chart-${index}`} className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
            <Skeleton width={180} height={20} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
            <div className="mt-4">
              <Skeleton height={240} borderRadius={12} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
        <Skeleton width={220} height={20} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`row-${index}`} height={28} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DisruptionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton width={250} height={28} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
        <Skeleton width={420} height={16} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Skeleton width={190} height={40} borderRadius={10} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
        <Skeleton width={160} height={40} borderRadius={10} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
        <Skeleton width={200} height={40} borderRadius={10} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
        <Skeleton width={90} height={40} borderRadius={10} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={`event-${index}`} className="rounded-xl border border-gray-800 bg-gray-900/60 px-5 py-4">
            <Skeleton width="70%" height={16} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
            <div className="mt-2">
              <Skeleton width="95%" height={14} baseColor={DARK_BASE} highlightColor={DARK_HIGHLIGHT} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataManagementSkeleton() {
  return (
    <div className="flex flex-col gap-8 p-8">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton width={230} height={28} baseColor={LIGHT_BASE} highlightColor={LIGHT_HIGHLIGHT} />
          <Skeleton width={360} height={16} baseColor={LIGHT_BASE} highlightColor={LIGHT_HIGHLIGHT} />
        </div>
        <Skeleton width={280} height={38} borderRadius={10} baseColor={LIGHT_BASE} highlightColor={LIGHT_HIGHLIGHT} />
      </div>

      <div className="rounded-2xl border border-[#b1b2ff]/20 bg-white p-6">
        <Skeleton width={240} height={20} baseColor={LIGHT_BASE} highlightColor={LIGHT_HIGHLIGHT} />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={`table-${index}`} height={34} baseColor={LIGHT_BASE} highlightColor={LIGHT_HIGHLIGHT} />
          ))}
        </div>
      </div>
    </div>
  );
}
