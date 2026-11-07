export default function ScoreBar({
  left,
  right,
}: {
  left: number;
  right: number;
}) {
  const total = Number(left) + Number(right);
  const leftPct =
    total <= 0 ? 50 : Math.max(5, Math.min(95, (Number(left) / total) * 100));

  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.07]">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-[width] duration-700 ease-out"
        style={{ width: `${leftPct}%` }}
      />
      <div
        className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-cyan-500 to-cyan-300 transition-[width] duration-700 ease-out"
        style={{ width: `${100 - leftPct}%` }}
      />
      <div className="absolute inset-y-0 left-1/2 w-px bg-black/40" />
    </div>
  );
}
