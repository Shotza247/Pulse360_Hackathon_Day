import { scaleTrendSeries } from "@/lib/system-admin-analytics";

type TrendLine = {
  label: string;
  color: string;
  values: number[];
  dashed?: boolean;
};

export function TrendChart({ title, description, labels, series }: {
  title: string;
  description: string;
  labels: string[];
  series: TrendLine[];
}) {
  const width = 720;
  const height = 220;
  const margin = { top: 16, right: 18, bottom: 34, left: 48 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const scaled = scaleTrendSeries(series.map((line) => line.values), plotWidth, plotHeight);
  const labelIndexes = Array.from(new Set([0, Math.floor((labels.length - 1) / 2), labels.length - 1])).filter((index) => index >= 0);

  return (
    <figure>
      <figcaption className="mb-3">
        <h3 className="text-sm font-bold text-gray-950">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </figcaption>
      <svg className="h-auto w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${description}`}>
        {[0, 0.5, 1].map((fraction) => {
          const y = margin.top + plotHeight * fraction;
          const value = Math.round(scaled.maxValue * (1 - fraction));
          return <g key={fraction}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#e5e7eb" strokeDasharray={fraction === 1 ? undefined : "3 4"} />
            <text x={margin.left - 8} y={y + 4} textAnchor="end" className="fill-gray-500" fontSize="11">{value}</text>
          </g>;
        })}
        {series.map((line, lineIndex) => {
          const points = scaled.points[lineIndex] ?? [];
          const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${margin.left + point.x},${margin.top + point.y}`).join(" ");
          return <g key={line.label}>
            {path && <path d={path} fill="none" stroke={line.color} strokeWidth="3" strokeDasharray={line.dashed ? "6 5" : undefined} strokeLinecap="round" strokeLinejoin="round" />}
            {points.map((point, pointIndex) => <circle key={`${line.label}-${pointIndex}`} cx={margin.left + point.x} cy={margin.top + point.y} r="3.5" fill={line.dashed ? "white" : line.color} stroke={line.color} strokeWidth="2">
              <title>{`${line.label}: ${line.values[pointIndex] ?? 0}`}</title>
            </circle>)}
          </g>;
        })}
        {labelIndexes.map((index) => {
          const x = margin.left + (labels.length <= 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
          return <text key={`${labels[index]}-${index}`} x={x} y={height - 8} textAnchor={index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle"} className="fill-gray-500" fontSize="11">{labels[index]}</text>;
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {series.map((line) => <span key={line.label} className="inline-flex items-center gap-2 text-xs text-gray-600">
          <span className={`h-0.5 w-5 ${line.dashed ? "border-t-2 border-dashed" : ""}`} style={{ backgroundColor: line.dashed ? "transparent" : line.color, borderColor: line.color }} />
          {line.label}
        </span>)}
      </div>
    </figure>
  );
}

export function HorizontalBarChart({ title, description, rows, color = "#0f766e", maxValue }: {
  title: string;
  description: string;
  rows: Array<{ label: string; value: number; displayValue?: string }>;
  color?: string;
  maxValue?: number;
}) {
  const width = 720;
  const rowHeight = 38;
  const labelWidth = 210;
  const valueWidth = 48;
  const barWidth = width - labelWidth - valueWidth - 20;
  const height = Math.max(78, rows.length * rowHeight + 20);
  const max = Math.max(1, maxValue ?? 0, ...rows.map((row) => row.value));

  return (
    <figure>
      <figcaption className="mb-3">
        <h3 className="text-sm font-bold text-gray-950">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </figcaption>
      {rows.length === 0 ? <p className="py-5 text-sm text-gray-500">No data in this scope.</p> : <svg className="h-auto w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${description}`}>
        {rows.map((row, index) => {
          const y = 12 + index * rowHeight;
          const bar = (row.value / max) * barWidth;
          return <g key={row.label}>
            <text x="0" y={y + 15} className="fill-gray-700" fontSize="12">{row.label.length > 31 ? `${row.label.slice(0, 28)}...` : row.label}<title>{row.label}</title></text>
            <rect x={labelWidth} y={y + 2} width={barWidth} height="18" rx="4" fill="#f1f5f9" />
            <rect x={labelWidth} y={y + 2} width={bar} height="18" rx="4" fill={color} />
            <text x={width} y={y + 16} textAnchor="end" className="fill-gray-700" fontSize="12" fontWeight="600">{row.displayValue ?? row.value.toLocaleString("en-ZA")}</text>
          </g>;
        })}
      </svg>}
    </figure>
  );
}
