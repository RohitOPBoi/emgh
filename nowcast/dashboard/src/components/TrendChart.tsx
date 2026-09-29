interface TrendPoint {
  leadMin: number;
  value: number;
}

/**
 * Precision sparkline for forecast variables.
 * Designed with a neutral baseline and clear data color.
 */
export function TrendChart({
  points,
  color = "var(--radar-3)",
  unit = "",
  height = 36,
}: {
  points: TrendPoint[];
  color?: string;
  unit?: string;
  height?: number;
}) {
  if (points.length < 2) return null;

  const width = 100; // viewBox units, scales via CSS width 100%
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values, min + 0.5);
  const xStep = width / (points.length - 1);

  const coords = points.map((p, i) => {
    const x = i * xStep;
    const y = height - ((p.value - min) / (max - min)) * (height - 12) - 6;
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <div style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="linearChartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Baseline grid */}
        <line x1="0" y1={height} x2={width} y2={height} stroke="var(--line)" strokeWidth="1" />

        {/* Subtle area fill */}
        <path d={areaPath} fill="url(#linearChartGrad)" />

        {/* Vector stroke */}
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.5} fill={color} />
        ))}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "var(--text-3)",
          fontFamily: "var(--font-num)",
          fontVariantNumeric: "tabular-nums",
          marginTop: 2,
        }}
      >
        <span>
          {min.toFixed(1)}
          {unit}
        </span>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>
          {max.toFixed(1)}
          {unit}
        </span>
      </div>
    </div>
  );
}
