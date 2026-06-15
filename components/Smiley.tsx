"use client";

type SmileyState = "red" | "yellow" | "green" | "neutral";

interface SmileyProps {
  state: SmileyState;
  title?: string;
}

export default function Smiley({ state, title }: SmileyProps) {
  if (state === "neutral") return null;

  const fillColor =
    state === "red" ? "#e85a5a" :
      state === "yellow" ? "#f5c518" :
        "#5cb87a";

  const strokeColor =
    state === "red" ? "#a83838" :
      state === "yellow" ? "#a8821a" :
        "#2e7044";

  const featureColor =
    state === "red" ? "#2a1010" :
      state === "yellow" ? "#2a2010" :
        "#10261a";

  const mouth =
    state === "red" ? "M 7 17 Q 12 13 17 17" :
      state === "yellow" ? "M 7 16 L 17 16" :
        "M 7 14 Q 12 19 17 14";

  const titleText =
    title ??
    (state === "red" ? "Off-target" :
      state === "yellow" ? "At risk" :
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
      <circle cx="12" cy="12" r="10" fill={fillColor} stroke={strokeColor} strokeWidth="1" />
      <ellipse cx="9" cy="10" rx="1.1" ry="1.7" fill={featureColor} />
      <ellipse cx="15" cy="10" rx="1.1" ry="1.7" fill={featureColor} />
      <path d={mouth} fill="none" stroke={featureColor} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}