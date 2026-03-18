export default function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  const gradient =
    clamped >= 100 ? 'from-emerald-400 to-emerald-500' :
    clamped >= 70  ? 'from-[#4a7fa5] to-[#2c5372]' :
    clamped >= 40  ? 'from-amber-400 to-amber-500' :
                     'from-slate-300 to-slate-400';

  return (
    <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700 ease-out`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
