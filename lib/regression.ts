export function linearRegression(vals: (number | null)[]): {
  slope: number;
  trendValues: (number | null)[];
} {
  const indexed: { x: number; y: number }[] = [];
  vals.forEach((v, i) => {
    if (v !== null) indexed.push({ x: i, y: v });
  });

  if (indexed.length < 2) {
    return { slope: 0, trendValues: vals.map(() => null) };
  }

  const n = indexed.length;
  const sumX = indexed.reduce((s, p) => s + p.x, 0);
  const sumY = indexed.reduce((s, p) => s + p.y, 0);
  const sumXY = indexed.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = indexed.reduce((s, p) => s + p.x * p.x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, trendValues: vals.map(() => null) };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const trendValues = vals.map((_, i) =>
    Math.round((slope * i + intercept) * 1000) / 1000
  );

  return { slope, trendValues };
}
