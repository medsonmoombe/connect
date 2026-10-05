'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';

/* ─── Types ────────────────────────────────────────────────────────────────── */

interface MatchData {
  id: string;
  project_id: string;
  capital_partner_id: string;
  compatibility_score: number;
  score_breakdown?: Record<string, any>;
  project?: {
    id: string;
    name: string;
    technology_type: string;
    location_country: string;
    project_stage: string;
    project_size_mw: number;
    capital_required: number;
  };
}

interface RiskDashboardProps {
  matches: MatchData[];
  className?: string;
}

/* ─── Risk level config ─────────────────────────────────────────────────────── */

const RISK_LEVELS = [
  { label: 'Low Risk', threshold: 75, color: 'bg-emerald-500', textColor: 'text-emerald-700', bg: 'bg-emerald-50', icon: <Icons.shieldCheck className="size-3.5" /> },
  { label: 'Medium Risk', threshold: 50, color: 'bg-amber-400', textColor: 'text-amber-700', bg: 'bg-amber-50', icon: <Icons.alertTriangle className="size-3.5" /> },
  { label: 'High Risk', threshold: 0, color: 'bg-red-400', textColor: 'text-red-700', bg: 'bg-red-50', icon: <Icons.alert className="size-3.5" /> },
];

/* ─── Sub-components ──────────────────────────────────────────────────────── */

/** Score ring for overall risk. */
function RiskScoreRing({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? '#10b981' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex items-center justify-center shrink-0">
        <svg className="size-16 -rotate-90" viewBox="0 0 60 60">
          <circle cx="30" cy="30" r="24" fill="none" stroke="#e2e8f0" strokeWidth="5" />
          <circle cx="30" cy="30" r="24" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 150.8} 150.8`} className="transition-all duration-1000 ease-out" />
        </svg>
        <span className="absolute text-sm font-extrabold text-slate-900">{value}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-slate-900">{label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {value >= 75 ? 'Well-diversified portfolio'
            : value >= 50 ? 'Moderate risk exposure'
            : 'Concentrated risk — review positions'}
        </p>
      </div>
    </div>
  );
}

/** Risk dimension bar. */
function RiskBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-700">{label}</span>
        <span className="text-xs font-bold text-slate-900">{Math.round(value)}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Risk flag card. */
function RiskFlagCard({ level, title, description, count }: {
  level: string; title: string; description: string; count: number;
}) {
  const color = level === 'HIGH' ? 'border-red-200 bg-red-50'
    : level === 'MEDIUM' ? 'border-amber-200 bg-amber-50'
    : 'border-slate-200 bg-slate-50';
  const dotColor = level === 'HIGH' ? 'bg-red-500'
    : level === 'MEDIUM' ? 'bg-amber-500'
    : 'bg-slate-400';
  return (
    <div className={cn('p-3 rounded-none border', color)}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', dotColor)} />
          <span className="text-xs font-bold text-slate-800">{title}</span>
        </div>
        <span className="text-[10px] font-bold text-slate-500">{count} project{count !== 1 ? 's' : ''}</span>
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function RiskDashboard({ matches, className }: RiskDashboardProps) {
  const [expanded, setExpanded] = useState(false);

  // Compute risk metrics from match data
  const riskMetrics = useMemo(() => {
    if (!matches.length) return null;

    // Risk tolerance alignment scores (from score_breakdown.risk_tolerance_alignment)
    const riskScores = matches
      .map(m => m.score_breakdown?.risk_tolerance_alignment)
      .filter((v): v is number => typeof v === 'number');

    const avgRiskAlignment = riskScores.length > 0
      ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length
      : 0;

    // Governance alignment scores
    const govScores = matches
      .map(m => m.score_breakdown?.governance_preference_alignment)
      .filter((v): v is number => typeof v === 'number');
    const avgGovAlignment = govScores.length > 0
      ? govScores.reduce((a, b) => a + b, 0) / govScores.length
      : 0;

    // Sector concentration
    const sectorCounts: Record<string, number> = {};
    for (const m of matches) {
      const tech = (m.project as any)?.technology_type;
      if (tech) sectorCounts[tech] = (sectorCounts[tech] || 0) + 1;
    }
    const topSector = Object.entries(sectorCounts)
      .sort(([, a], [, b]) => b - a)[0];
    const sectorConcentration = topSector
      ? Math.round((topSector[1] / matches.length) * 100)
      : 0;

    // Geographic concentration
    const geoCounts: Record<string, number> = {};
    for (const m of matches) {
      const country = (m.project as any)?.location_country;
      if (country) geoCounts[country] = (geoCounts[country] || 0) + 1;
    }
    const topGeo = Object.entries(geoCounts)
      .sort(([, a], [, b]) => b - a)[0];
    const geoConcentration = topGeo
      ? Math.round((topGeo[1] / matches.length) * 100)
      : 0;

    // Project stage distribution
    const stageCounts: Record<string, number> = {};
    for (const m of matches) {
      const stage = (m.project as any)?.project_stage;
      if (stage) stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    }

    // Capital size variance (risk indicator)
    const capitals = matches
      .map(m => (m.project as any)?.capital_required)
      .filter((v): v is number => typeof v === 'number' && v > 0);
    const avgCapital = capitals.length > 0
      ? capitals.reduce((a, b) => a + b, 0) / capitals.length
      : 0;
    const capitalVariance = capitals.length > 0
      ? Math.round(
        capitals.reduce((sum, c) => sum + Math.abs(c - avgCapital), 0) /
        capitals.length / (avgCapital || 1) * 100
      )
      : 0;

    return {
      avgRiskAlignment,
      avgGovAlignment,
      sectorConcentration,
      geoConcentration,
      stageCounts,
      capitalVariance,
      projectCount: matches.length,
    };
  }, [matches]);

  if (!matches.length || !riskMetrics) return null;

  // Overall risk score (higher = safer/more diversified)
  const overallRiskScore = Math.round(
    (riskMetrics.avgRiskAlignment * 0.4) +
    (riskMetrics.avgGovAlignment * 0.2) +
    ((100 - Math.min(100, riskMetrics.sectorConcentration)) * 0.2) +
    ((100 - Math.min(100, riskMetrics.geoConcentration)) * 0.2)
  );

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-none bg-red-50 flex items-center justify-center text-red-500">
            <Icons.alertTriangle className="size-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Risk Assessment</h3>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
        >
          {expanded ? 'Show Less' : 'Full Analysis'}
        </button>
      </div>

      {/* Overall risk score */}
      <div className="p-5 rounded-none bg-white border border-slate-100 shadow-soft">
        <RiskScoreRing value={overallRiskScore} label="Portfolio Risk Score" />

        {/* Risk dimensions */}
        <div className="mt-5 space-y-3">
          <RiskBar label="Risk Alignment" value={Math.round(riskMetrics.avgRiskAlignment)} color="bg-blue-500" />
          <RiskBar label="Governance Fit" value={Math.round(riskMetrics.avgGovAlignment)} color="bg-violet-500" />
          <RiskBar label="Sector Diversification" value={100 - Math.min(100, riskMetrics.sectorConcentration)} color="bg-emerald-500" />
          <RiskBar label="Geographic Diversification" value={100 - Math.min(100, riskMetrics.geoConcentration)} color="bg-cyan-500" />
        </div>
      </div>

      {/* Risk flags */}
      {expanded && (
        <div className="space-y-3">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Risk Signals</p>
          {riskMetrics.sectorConcentration > 50 && (
            <RiskFlagCard
              level="MEDIUM"
              title="Sector Concentration"
              description={`${Math.round(riskMetrics.sectorConcentration)}% of matches are in one sector. Consider diversifying across technologies.`}
              count={Math.round((riskMetrics.sectorConcentration / 100) * riskMetrics.projectCount)}
            />
          )}
          {riskMetrics.geoConcentration > 60 && (
            <RiskFlagCard
              level="MEDIUM"
              title="Geographic Concentration"
              description={`${Math.round(riskMetrics.geoConcentration)}% of matches are in one country. Geographic diversification may reduce political risk.`}
              count={Math.round((riskMetrics.geoConcentration / 100) * riskMetrics.projectCount)}
            />
          )}
          {riskMetrics.avgRiskAlignment < 60 && (
            <RiskFlagCard
              level="HIGH"
              title="Risk Tolerance Mismatch"
              description="Average risk alignment is below 60%. Projects may not match your risk appetite."
              count={riskMetrics.projectCount}
            />
          )}
          {riskMetrics.capitalVariance > 80 && (
            <RiskFlagCard
              level="LOW"
              title="Capital Size Variance"
              description="Wide variation in project capital requirements across your matches."
              count={riskMetrics.projectCount}
            />
          )}
          {Object.keys(riskMetrics.stageCounts).length <= 1 && (
            <RiskFlagCard
              level="LOW"
              title="Stage Concentration"
              description={`All matches are in the same project stage (${Object.keys(riskMetrics.stageCounts)[0]?.replace(/_/g, ' ')}).`}
              count={riskMetrics.projectCount}
            />
          )}
        </div>
      )}
    </div>
  );
}
