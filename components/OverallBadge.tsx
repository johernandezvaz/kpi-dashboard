"use client";

import styles from "./OverallBadge.module.css";
import { getColor } from "@/lib/scorecard";

interface OverallBadgeProps {
  ratio: number | null;
}

export default function OverallBadge({ ratio }: OverallBadgeProps) {
  const color = getColor(ratio);
  const label =
    ratio !== null ? `${(ratio * 100).toFixed(1)}%` : "—";

  return (
    <div
      className={`${styles.badge} ${styles[color]}`}
      aria-label={`Overall compliance: ${label}`}
    >
      <span className={styles.caption}>Overall</span>
      <span className={styles.value}>{label}</span>
    </div>
  );
}
