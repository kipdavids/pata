export default function TurnPips({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  const safeTotal = Math.max(1, total);
  return (
    <div
      className="flex items-center gap-[3px]"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={safeTotal}
      aria-valuenow={Math.min(current + 1, safeTotal)}
      aria-label={`Turn ${Math.min(current + 1, safeTotal)} of ${safeTotal}`}
    >
      {Array.from({ length: safeTotal }).map((_, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
              done
                ? "bg-emerald-400"
                : active
                  ? "animate-pulse bg-white/80"
                  : "bg-white/10"
            }`}
          />
        );
      })}
    </div>
  );
}
