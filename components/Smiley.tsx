"use client";

type SmileyState = "red" | "yellow" | "green" | "neutral";

interface SmileyProps {
  state: SmileyState;
  title?: string;
}

export default function Smiley({ state, title }: SmileyProps) {
  if (state === "neutral") return null;

  const color =
    state === "red"    ? "#d64545" :
    state === "yellow" ? "#d4a017" :
                         "#4a9d6f";

  const mouth =
    state === "red"    ? "M 6 16 Q 12 11 18 16" :
    state === "yellow" ? "M 6 15 L 18 15"        :
                         "M 6 13 Q 12 19 18 13";

  const titleText =
    title ??
    (state === "red"    ? "Off-target"   :
     state === "yellow" ? "At risk"      :
                          "On target");

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      role="img"
      aria-label={titleText}
    >
      <title>{titleText}</title>
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="1.8" />
      <ellipse cx="8.5" cy="10" rx="1.2" ry="1.8" fill={color} />
      <ellipse cx="15.5" cy="10" rx="1.2" ry="1.8" fill={color} />
      <path d={mouth} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
