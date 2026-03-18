interface Props {
  estimated: number;
  actual: number;
  showBar?: boolean;
}

export default function HoursDisplay({ estimated, actual, showBar = true }: Props) {
  const pct = estimated > 0 ? (actual / estimated) * 100 : 0;
  const overBudget = pct > 100;
  const warning = pct > 80 && pct <= 100;

  const barColor = overBudget ? 'from-[#e83948] to-[#f08a94]' : warning ? 'from-amber-400 to-amber-500' : 'from-[#4a7fa5] to-[#c7b475]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          <span className="font-semibold text-slate-800">{actual.toFixed(1)}h</span>
          <span className="mx-1 text-slate-300">/</span>
          <span>{estimated.toFixed(1)}h previstas</span>
        </span>
        {estimated > 0 && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${overBudget ? 'bg-red-50 text-red-600' : warning ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
      {showBar && estimated > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
