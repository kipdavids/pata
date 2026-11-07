"use client";

import { useEffect, useState } from "react";
import { formatElapsed, toMillis } from "@/lib/game";

export default function LiveTimer({
  targetSince,
  clockOffset,
  className,
}: {
  targetSince: string;
  clockOffset: number;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 50);
    return () => window.clearInterval(interval);
  }, []);

  const elapsedUs = Math.max(
    0,
    (now + clockOffset - toMillis(targetSince)) * 1000,
  );

  return (
    <span role="timer" className={`tabular-nums ${className ?? ""}`}>
      {formatElapsed(elapsedUs)}
    </span>
  );
}
