export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="skeleton w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      </div>
      <div className="skeleton h-2 w-full rounded-full" />
      <div className="flex gap-2">
        <div className="skeleton h-6 w-16 rounded-lg" />
        <div className="skeleton h-6 w-16 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-slate-50">
      <div className="skeleton w-8 h-8 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-3 w-1/4" />
      </div>
      <div className="skeleton h-6 w-20 rounded-lg" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="skeleton h-8 w-48" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-10 w-40 rounded-xl" />
      </div>

      {/* Health + Cards row */}
      <div className="flex gap-6">
        <div className="w-52 rounded-2xl border border-slate-100 bg-white p-6 flex flex-col items-center gap-4">
          <div className="skeleton w-[120px] h-[120px] rounded-full" />
          <div className="skeleton h-3 w-20" />
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
        <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-200/50 p-5 space-y-3">
              <div className="skeleton w-8 h-8 rounded-lg" />
              <div className="skeleton h-8 w-16" />
              <div className="skeleton h-3 w-24" />
            </div>
          ))}
        </div>
      </div>

      {/* Metric bars */}
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="skeleton w-8 h-8 rounded-xl" />
                <div className="skeleton h-4 w-20" />
              </div>
              <div className="skeleton h-6 w-32" />
            </div>
            <div className="skeleton h-2.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* Timeline placeholder */}
      <div className="rounded-2xl border bg-white p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-48 w-full" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-2xl border bg-white p-6">
          <div className="skeleton h-5 w-36 mb-4" />
          <div className="skeleton h-[280px] w-full" />
        </div>
        <div className="rounded-2xl border bg-white p-6">
          <div className="skeleton h-5 w-36 mb-4" />
          <div className="skeleton h-[280px] w-full" />
        </div>
      </div>
    </div>
  );
}
