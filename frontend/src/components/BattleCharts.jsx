import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { buildRadarSeries, buildStrengthWeaknessBars } from '../utils/battlecardMetrics.js';
import { useDarkMode } from '../hooks/useDarkMode.js';

const cardShell =
  'flex h-full min-h-0 w-full flex-col rounded-xl border p-4 shadow-lg backdrop-blur-sm transition-colors duration-300 border-slate-200/90 bg-white/90 dark:border-indigo-500/20 dark:bg-slate-900/60';

function useChartTheme() {
  const isDark = useDarkMode();
  const gridStroke = isDark ? '#334155' : '#cbd5e1';
  const axisTick = isDark ? '#94a3b8' : '#64748b';
  const axisLabel = isDark ? '#cbd5e1' : '#475569';
  const cartesianStroke = isDark ? '#1e293b' : '#e2e8f0';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '1px solid rgba(51, 65, 85, 0.9)' : '1px solid rgba(226, 232, 240, 1)',
    borderRadius: '8px',
    fontSize: '12px',
    color: isDark ? '#e2e8f0' : '#0f172a',
    boxShadow: isDark ? 'none' : '0 4px 24px rgba(15,23,42,0.08)',
  };
  return { isDark, gridStroke, axisTick, axisLabel, cartesianStroke, tooltipStyle };
}

/** Mobile: aspect box gives plot height. `md+`: flex-1 fills stretched grid row. */
function ChartPlotArea({ children }) {
  return (
    <div className="relative w-full flex-1 min-h-0">
      <div className="aspect-[5/4] w-full md:absolute md:inset-0 md:aspect-auto md:h-full">
        {children}
      </div>
    </div>
  );
}

export function BattleRadarCard({ battlecard }) {
  const { isDark, gridStroke, axisTick, tooltipStyle } = useChartTheme();
  const radar = buildRadarSeries(battlecard);

  return (
    <div className={cardShell}>
      <div className="mb-3 flex shrink-0 items-start gap-2">
        <span className="text-lg" aria-hidden>
          📡
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 transition-colors duration-300 dark:text-slate-100">
            Profile radar
          </h3>
          <p className="text-xs text-slate-600 transition-colors duration-300 dark:text-slate-500">
            Relative signal strength by section (heuristic)
          </p>
        </div>
      </div>
      <ChartPlotArea>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radar}>
            <PolarGrid stroke={gridStroke} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: axisTick, fontSize: 11 }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Score"
              dataKey="score"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={isDark ? 0.45 : 0.35}
              strokeWidth={2}
            />
            <Tooltip formatter={(v) => [`${v}`, 'Signal']} contentStyle={tooltipStyle} />
          </RadarChart>
        </ResponsiveContainer>
      </ChartPlotArea>
    </div>
  );
}

export function BattleStrengthsBarCard({ battlecard }) {
  const { axisTick, axisLabel, cartesianStroke, tooltipStyle } = useChartTheme();
  const bars = buildStrengthWeaknessBars(battlecard);

  return (
    <div className={cardShell}>
      <div className="mb-3 flex shrink-0 items-start gap-2">
        <span className="text-lg" aria-hidden>
          📊
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900 transition-colors duration-300 dark:text-slate-100">
            Strengths vs gaps
          </h3>
          <p className="text-xs text-slate-600 transition-colors duration-300 dark:text-slate-500">
            Content depth in strengths (green) vs weaknesses (red)
          </p>
        </div>
      </div>
      <ChartPlotArea>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={bars} margin={{ left: 4, right: 16, top: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={cartesianStroke} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} stroke={axisTick} tick={{ fill: axisLabel, fontSize: 11 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={128}
              stroke={axisTick}
              tick={{ fill: axisLabel, fontSize: 11 }}
            />
            <Tooltip formatter={(v) => [`${v}`, 'Score']} contentStyle={tooltipStyle} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ChartPlotArea>
    </div>
  );
}

/** Two-column layout when no chat rail (same stretch behavior). */
export default function BattleCharts({ battlecard }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
      <div className="flex min-h-0 min-w-0 md:h-full">
        <BattleRadarCard battlecard={battlecard} />
      </div>
      <div className="flex min-h-0 min-w-0 md:h-full">
        <BattleStrengthsBarCard battlecard={battlecard} />
      </div>
    </div>
  );
}
