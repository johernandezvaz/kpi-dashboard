import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Svg,
  Circle,
  Ellipse,
  Path,
  Line,
} from "@react-pdf/renderer";


interface MetricHistoryPoint {
  year: number;
  month: number;
  label: string;
  resultValue: number | null;
  yellowLimit: number | null;
  greenLimit: number | null;
}

interface PDFMetric {
  metricId: string;
  name: string;
  unit: string | null;
  higherIsBetter: boolean;
  currentMonth: {
    resultValue: number | null;
    yellowLimit: number | null;
    greenLimit: number | null;
    color: "red" | "yellow" | "green" | "neutral";
  };
  history: MetricHistoryPoint[];
}

interface PDFData {
  plant: { code: string; name: string };
  year: number;
  month: number;
  monthLabel: string;
  metrics: PDFMetric[];
}

interface MetricsPDFDocumentProps {
  data: PDFData;
}


const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#0e254e",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1d559a",
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: "contain",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0e254e",
  },
  headerSubtitle: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
    fontSize: 8,
    color: "#6b7280",
  },

  tableWrapper: {
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#0e254e",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#0e254e",
  },
  tableDataRow: {
    flexDirection: "row",
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#1d3a70",
  },
  tableHeaderCellLast: {
    flex: 1,
    padding: 6,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textAlign: "center",
  },
  tableCell: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#0e254e",
  },
  tableCellLast: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    textAlign: "center",
  },
  tableCellResult: {
    flex: 1,
    padding: 6,
    fontSize: 10,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#0e254e",
    fontFamily: "Helvetica-Bold",
  },
  colorGreen: { backgroundColor: "#5cb87a", color: "#ffffff" },
  colorYellow: { backgroundColor: "#f5c518", color: "#ffffff" },
  colorRed: { backgroundColor: "#e85a5a", color: "#ffffff" },
  colorNeutral: {},

  chartArea: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
  },
  indicatorColumn: {
    width: 60,
    alignItems: "center",
    gap: 12,
    paddingTop: 20,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#9ca3af",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
});



function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(2);
}

function getMonthName(month: number): string {
  const names = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return names[month - 1] ?? "";
}

function calcSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (values[i] - my);
    den += (i - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}


interface MetricChartPDFProps {
  history: Array<{
    label: string;
    resultValue: number | null;
    yellowLimit: number | null;
    greenLimit: number | null;
  }>;
  width: number;
  height: number;
}

function MetricChartPDF({ history, width, height }: MetricChartPDFProps) {
  const padLeft = 38;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 36;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const validValues = history
    .map((h) => h.resultValue)
    .filter((v): v is number => v !== null);
  const allLimitValues = history.flatMap((h) =>
    [h.yellowLimit, h.greenLimit].filter((v): v is number => v !== null)
  );
  const allValues = [...validValues, ...allLimitValues];


  if (allValues.length === 0) {
    return (
      <Svg width={width} height={height}>
        <Text
          x={width / 2}
          y={height / 2}
          style={{ fontSize: 10, fill: "#9ca3af" } as object}
        >
          No data
        </Text>
      </Svg>
    );
  }

  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const range = rawMax - rawMin || 1;
  const yMin = rawMin - range * 0.1;
  const yMax = rawMax + range * 0.1;

  const N = history.length;

  function xCoord(i: number): number {
    return padLeft + (N <= 1 ? innerW / 2 : (i / (N - 1)) * innerW);
  }
  function yCoord(v: number): number {
    return padTop + (1 - (v - yMin) / (yMax - yMin)) * innerH;
  }


  const validWithIdx = history
    .map((h, i) => ({ i, v: h.resultValue }))
    .filter((p): p is { i: number; v: number } => p.v !== null);

  let slope = 0, intercept = 0;
  if (validWithIdx.length >= 2) {
    const n = validWithIdx.length;
    const mx = validWithIdx.reduce((s, p) => s + p.i, 0) / n;
    const my = validWithIdx.reduce((s, p) => s + p.v, 0) / n;
    let num = 0, den = 0;
    for (const p of validWithIdx) {
      num += (p.i - mx) * (p.v - my);
      den += (p.i - mx) ** 2;
    }
    slope = den === 0 ? 0 : num / den;
    intercept = my - slope * mx;
  }


  function buildPath(getValue: (h: MetricChartPDFProps["history"][0]) => number | null): string {
    let path = "";
    let penDown = false;
    history.forEach((h, i) => {
      const val = getValue(h);
      if (val === null) { penDown = false; return; }
      const cmd = penDown ? "L" : "M";
      path += ` ${cmd} ${xCoord(i).toFixed(2)} ${yCoord(val).toFixed(2)}`;
      penDown = true;
    });
    return path.trim();
  }

  const resultPath = buildPath((h) => h.resultValue);
  const yellowPath = buildPath((h) => h.yellowLimit);
  const greenPath = buildPath((h) => h.greenLimit);

  const trendPath =
    validWithIdx.length >= 2
      ? `M ${xCoord(0).toFixed(2)} ${yCoord(intercept).toFixed(2)} ` +
      `L ${xCoord(N - 1).toFixed(2)} ${yCoord(intercept + slope * (N - 1)).toFixed(2)}`
      : "";


  const ticks: number[] = Array.from({ length: 5 }, (_, i) =>
    yMin + (i / 4) * (yMax - yMin)
  );

  return (
    <Svg width={width} height={height}>

      {ticks.map((tv, i) => (
        <Line
          key={`grid-${i}`}
          x1={padLeft} y1={yCoord(tv)}
          x2={padLeft + innerW} y2={yCoord(tv)}
          stroke="#0e254e"
          strokeOpacity={0.1}
          strokeWidth={0.5}
          strokeDasharray="3 3"
        />
      ))}


      {ticks.map((tv, i) => (
        <Text
          key={`ytick-${i}`}
          x={padLeft - 4}
          y={yCoord(tv) + 3}
          style={{ fontSize: 7, fill: "#6b7280" } as object}
        >
          {tv.toFixed(1)}
        </Text>
      ))}

      {history.map((h, i) => {
        if (i % 2 !== 0 && i !== N - 1) return null;
        return (
          <Text
            key={`xtick-${i}`}
            x={xCoord(i)}
            y={padTop + innerH + 12}
            style={{ fontSize: 7, fill: "#6b7280" } as object}
          >
            {h.label}
          </Text>
        );
      })}


      {greenPath && <Path d={greenPath} stroke="#4caf72" strokeWidth={1.2} fill="none" />}


      {yellowPath && <Path d={yellowPath} stroke="#f5c518" strokeWidth={1.2} fill="none" />}
      {trendPath && (
        <Path d={trendPath} stroke="#9ca3af" strokeWidth={1} strokeDasharray="4 3" fill="none" />
      )}

      {resultPath && <Path d={resultPath} stroke="#1d559a" strokeWidth={1.8} fill="none" />}

      {history.map((h, i) => {
        if (h.resultValue === null) return null;
        return (
          <Circle
            key={`dot-${i}`}
            cx={xCoord(i)}
            cy={yCoord(h.resultValue)}
            r={2.2}
            fill="#1d559a"
          />
        );
      })}
    </Svg>
  );
}


function SmileyPDF({ state }: { state: "red" | "yellow" | "green" | "neutral" }) {
  if (state === "neutral") return null;

  const fill =
    state === "red" ? "#e85a5a" :
      state === "yellow" ? "#f5c518" : "#5cb87a";
  const stroke =
    state === "red" ? "#a83838" :
      state === "yellow" ? "#a8821a" : "#2e7044";
  const feature =
    state === "red" ? "#2a1010" :
      state === "yellow" ? "#2a2010" : "#10261a";
  const mouthPath =
    state === "red" ? "M 7 17 Q 12 13 17 17" :
      state === "yellow" ? "M 7 16 L 17 16" :
        "M 7 14 Q 12 19 17 14";

  return (
    <Svg width="40" height="40" viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" fill={fill} stroke={stroke} strokeWidth="1" />
      <Ellipse cx="9" cy="10" rx="1.1" ry="1.7" fill={feature} />
      <Ellipse cx="15" cy="10" rx="1.1" ry="1.7" fill={feature} />
      <Path d={mouthPath} fill="none" stroke={feature} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}



function TrendArrowPDF({
  slope,
  higherIsBetter,
}: {
  slope: number;
  higherIsBetter: boolean;
}) {
  const flat = Math.abs(slope) < 0.001;

  if (flat) {
    return (
      <Svg width="32" height="32" viewBox="0 0 24 24">
        <Line x1="4" y1="12" x2="20" y2="12" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" />
      </Svg>
    );
  }

  const isImproving =
    (higherIsBetter && slope > 0) || (!higherIsBetter && slope < 0);
  const color = isImproving ? "#5cb87a" : "#e85a5a";

  const shaftAndArrow =
    slope > 0
      ? "M 12 20 L 12 4 M 5 11 L 12 4 L 19 11"
      : "M 12 4 L 12 20 M 5 13 L 12 20 L 19 13";

  return (
    <Svg width="32" height="32" viewBox="0 0 24 24">
      <Path
        d={shaftAndArrow}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function MetricsPDFDocument({ data }: MetricsPDFDocumentProps) {
  const exportedAt = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Document
      title={`Metrics Report — ${data.plant.name} ${data.monthLabel} ${data.year}`}
      author="KPI Dashboard"
    >
      {data.metrics.map((m) => {
        const validValues = m.history
          .map((h) => h.resultValue)
          .filter((v): v is number => v !== null);
        const slope = calcSlope(validValues);

        const colorStyle =
          m.currentMonth.color === "green" ? styles.colorGreen :
            m.currentMonth.color === "yellow" ? styles.colorYellow :
              m.currentMonth.color === "red" ? styles.colorRed :
                styles.colorNeutral;

        return (
          <Page key={m.metricId} size="A4" style={styles.page}>

            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Image
                  src="/safe-demo_logo-blc-Photoroom.png"
                  style={styles.logo}
                />
                <View>
                  <Text style={styles.headerTitle}>Metrics Report</Text>
                  <Text style={styles.headerSubtitle}>{data.plant.name}</Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                <Text>Exported:</Text>
                <Text>{exportedAt}</Text>
              </View>
            </View>

            <View style={styles.tableWrapper}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.tableHeaderCell}>YEAR</Text>
                <Text style={styles.tableHeaderCell}>MONTH</Text>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>DESCRIPTION</Text>
                <Text style={styles.tableHeaderCell}>RESULT</Text>
                <Text style={styles.tableHeaderCell}>YELLOW LIMIT</Text>
                <Text style={styles.tableHeaderCellLast}>GREEN LIMIT</Text>
              </View>
              <View style={styles.tableDataRow}>
                <Text style={styles.tableCell}>{data.year}</Text>
                <Text style={styles.tableCell}>{getMonthName(data.month)}</Text>
                <Text style={{ ...styles.tableCell, flex: 2, textAlign: "left" }}>
                  {m.name}{m.unit ? ` (${m.unit})` : ""}
                </Text>
                <Text style={{ ...styles.tableCellResult, ...colorStyle }}>
                  {fmt(m.currentMonth.resultValue)}
                </Text>
                <Text style={styles.tableCell}>{fmt(m.currentMonth.yellowLimit)}</Text>
                <Text style={styles.tableCellLast}>{fmt(m.currentMonth.greenLimit)}</Text>
              </View>
            </View>

            <View style={styles.chartArea}>
              <View style={{ flex: 1 }}>
                <MetricChartPDF history={m.history} width={460} height={220} />
              </View>
              <View style={styles.indicatorColumn}>
                <SmileyPDF state={m.currentMonth.color} />
                <TrendArrowPDF slope={slope} higherIsBetter={m.higherIsBetter} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 14, marginTop: 8, paddingLeft: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Svg width="14" height="6">
                  <Line x1="0" y1="3" x2="14" y2="3" stroke="#1d559a" strokeWidth={1.8} />
                </Svg>
                <Text style={{ fontSize: 7, color: "#6b7280" }}>Result</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Svg width="14" height="6">
                  <Line x1="0" y1="3" x2="14" y2="3" stroke="#4caf72" strokeWidth={1.2} />
                </Svg>
                <Text style={{ fontSize: 7, color: "#6b7280" }}>Green limit</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Svg width="14" height="6">
                  <Line x1="0" y1="3" x2="14" y2="3" stroke="#f5c518" strokeWidth={1.2} />
                </Svg>
                <Text style={{ fontSize: 7, color: "#6b7280" }}>Yellow limit</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Svg width="14" height="6">
                  <Line x1="0" y1="3" x2="14" y2="3" stroke="#9ca3af" strokeWidth={1} strokeDasharray="2 2" />
                </Svg>
                <Text style={{ fontSize: 7, color: "#6b7280" }}>Trend</Text>
              </View>
            </View>

            <View style={styles.footer} fixed>
              <Text>{exportedAt}</Text>
              <Text
                render={({ pageNumber, totalPages }) =>
                  `Page ${pageNumber} of ${totalPages}`
                }
              />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
