'use client';

import { cn } from '@/lib/utils';
import { topMatchReasons } from '@/lib/matching-engine';

// â”€â”€ Config for every possible breakdown key across all match types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DIMENSION_META: Record<string, { label: string; weight: string; icon: string }> = {
  // Capital
  capital_overlap:                    { label: 'Capital Range',       weight: '30%', icon: 'ðŸ’°' },
  structure:                          { label: 'Structure Fit',       weight: '20%', icon: 'ðŸ—ï¸' },
  risk:                               { label: 'Risk Alignment',      weight: '15%', icon: 'ðŸ›¡ï¸' },
  governance:                         { label: 'Governance Fit',      weight: '15%', icon: 'âš–ï¸' },
  sector:                             { label: 'Sector Match',        weight: '10%', icon: 'âš¡' },
  geography:                          { label: 'Geography',           weight: '10%', icon: 'ðŸ“' },
  // Technical & Consultant
  sector_tech:                        { label: 'Sector / Technology', weight: '25%', icon: 'âš¡' },
  project_size:                       { label: 'Project Size (MW)',   weight: '25%', icon: 'ðŸ“' },
  ticket_size:                        { label: 'Ticket Size',         weight: '20%', icon: 'ðŸ’°' },
  service_fit:                        { label: 'Service Fit',         weight: '25%', icon: 'ðŸ”§' },
  experience:                         { label: 'Experience',          weight: '15â€“20%', icon: 'ðŸ†' },
  // Legacy flat keys (backward compat â€” shown only if no object form exists)
  capital_range_overlap:              { label: 'Capital Range',       weight: '30%', icon: 'ðŸ’°' },
  structure_compatibility:            { label: 'Structure Fit',       weight: '20%', icon: 'ðŸ—ï¸' },
  risk_tolerance_alignment:           { label: 'Risk Alignment',      weight: '15%', icon: 'ðŸ›¡ï¸' },
  governance_preference_alignment:    { label: 'Governance Fit',      weight: '15%', icon: 'âš–ï¸' },
  sector_match:                       { label: 'Sector Match',        weight: '10%', icon: 'âš¡' },
  geographic_match:                   { label: 'Geography',           weight: '10%', icon: 'ðŸ“' },
};

// Keys that are NOT dimensions (bonuses, raw_ prefixed legacy, etc.)
const SKIP_KEYS = new Set([
  'bonuses', 'raw_sector_tech', 'raw_project_size', 'raw_ticket_size',
  'raw_geography', 'raw_experience', 'raw_service_fit',
]);

// Preferred display order
const DIMENSION_ORDER = [
  'capital_overlap', 'sector', 'sector_tech', 'service_fit',
  'structure', 'project_size', 'ticket_size',
  'risk', 'governance', 'geography', 'experience',
  // legacy fallbacks
  'capital_range_overlap', 'structure_compatibility', 'risk_tolerance_alignment',
  'governance_preference_alignment', 'sector_match', 'geographic_match',
];

interface Dimension {
  key: string;
  label: string;
  weight: string;
  icon: string;
  score: number;       // weighted contribution (0â€“max_weight)
  rawScore: number;    // 0â€“100 sub-score
  detail: string;
}

export function parseBreakdown(breakdown: Record<string, any> | undefined): Dimension[] {
  if (!breakdown) return [];

  const dims: Dimension[] = [];
  const seen = new Set<string>();

  for (const key of DIMENSION_ORDER) {
    if (SKIP_KEYS.has(key)) continue;
    const val = breakdown[key];
    if (val === undefined) continue;

    const meta = DIMENSION_META[key];
    if (!meta) continue;

    // Deduplicate: if we already have a richer version of this dimension, skip legacy key
    if (seen.has(meta.label)) continue;
    seen.add(meta.label);

    if (typeof val === 'object' && val !== null && 'score' in val) {
      // PRD Â§5.4 detailed form: { score: weighted_pts, detail: string }
      dims.push({
        key,
        label: meta.label,
        weight: meta.weight,
        icon: meta.icon,
        score: Math.round(val.score ?? 0),
        rawScore: deriveRaw(key, val.score, breakdown),
        detail: typeof val.detail === 'string' ? val.detail : '',
      });
    } else if (typeof val === 'number') {
      // Legacy flat number â€” treat as weighted score directly
      dims.push({
        key,
        label: meta.label,
        weight: meta.weight,
        icon: meta.icon,
        score: Math.min(val, 30),
        rawScore: val,
        detail: '',
      });
    }
  }

  return dims;
}

/** Derive a 0â€“100 raw sub-score from the weighted score using the raw_ key if available. */
function deriveRaw(key: string, weightedScore: number, breakdown: Record<string, any>): number {
  const rawKey = `raw_${key}`;
  if (breakdown[rawKey] !== undefined) return Math.round(breakdown[rawKey]);
  // Infer from weighted score â€” use max weight per dimension
  const MAX_WEIGHTS: Record<string, number> = {
    capital_overlap: 30, structure: 20, risk: 15, governance: 15,
    sector: 10, geography: 10, sector_tech: 25, project_size: 25,
    ticket_size: 20, service_fit: 25, experience: 20,
  };
  const max = MAX_WEIGHTS[key] ?? 25;
  return max > 0 ? Math.min(100, Math.round((weightedScore / max) * 100)) : 0;
}

function ScoreBar({ value, className }: { value: number; className?: string }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className={cn('h-1.5 bg-slate-100 overflow-hidden', className)}>
      <div
        className={cn('h-full transition-all duration-500', color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

interface MatchBreakdownPanelProps {
  breakdown: Record<string, any> | undefined;
  totalScore: number;
  /** compact = 2-col grid without detail text; full = single col with detail */
  variant?: 'compact' | 'full';
}

export function MatchBreakdownPanel({ breakdown, totalScore, variant = 'compact' }: MatchBreakdownPanelProps) {
  const dims = parseBreakdown(breakdown);
  const topReasons = topMatchReasons({ score_breakdown: breakdown }, 3);

  // Bonus info
  const bonuses = breakdown?.bonuses;
  const stageBonus = bonuses?.stage_alignment?.score ?? 0;
  const epcBonus = bonuses?.joint_entity?.score ?? 0;
  const totalBonus = stageBonus + epcBonus;

  if (dims.length === 0) return null;

  if (variant === 'full') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Match Breakdown</p>
          <span className={cn(
            'text-xs font-extrabold px-2 py-0.5 border',
            totalScore >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : totalScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-slate-50 text-slate-500 border-slate-200'
          )}>
            {totalScore}% overall
          </span>
        </div>

        {topReasons.length > 0 && (
          <div className="border border-slate-100 bg-white p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Why this match</p>
            <ul className="space-y-1">
              {topReasons.map((r, i) => (
                <li key={i} className="text-[11px] text-slate-600 font-medium leading-snug flex gap-1.5">
                  <span className="text-emerald-500 shrink-0">-</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {dims.map((d) => (
          <div key={d.key} className="border border-slate-100 bg-slate-50/50 p-3">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm leading-none">{d.icon}</span>
                <span className="text-[11px] font-bold text-slate-700 truncate">{d.label}</span>
                <span className="text-[9px] font-bold text-slate-300 tracking-widest shrink-0">({d.weight})</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={cn(
                  'text-[10px] font-extrabold',
                  d.rawScore >= 80 ? 'text-emerald-600' : d.rawScore >= 50 ? 'text-amber-600' : 'text-red-500'
                )}>
                  {d.rawScore}%
                </span>
                <span className="text-[9px] text-slate-300">â†’</span>
                <span className="text-[10px] font-bold text-slate-500">{d.score}pts</span>
              </div>
            </div>
            <ScoreBar value={d.rawScore} className="mb-1.5" />
            {d.detail && (
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{d.detail}</p>
            )}
          </div>
        ))}

        {totalBonus > 0 && (
          <div className="border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700">ðŸŽ¯ Bonuses applied</span>
              <span className="text-[10px] font-extrabold text-emerald-600">+{totalBonus}pts</span>
            </div>
            {stageBonus > 0 && (
              <p className="text-[11px] text-emerald-600 mt-1">{bonuses.stage_alignment.detail}</p>
            )}
            {epcBonus > 0 && (
              <p className="text-[11px] text-emerald-600 mt-0.5">{bonuses.joint_entity.detail}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // compact variant â€” 2-col grid, no detail text
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score Breakdown</p>
      <div className="grid grid-cols-2 gap-1.5">
        {dims.map((d) => (
          <div key={d.key} className="border border-slate-100 bg-slate-50 px-2.5 py-2">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-600 truncate">{d.icon} {d.label}</span>
              <span className={cn(
                'text-[10px] font-extrabold shrink-0',
                d.rawScore >= 80 ? 'text-emerald-600' : d.rawScore >= 50 ? 'text-amber-500' : 'text-red-400'
              )}>
                {d.rawScore}%
              </span>
            </div>
            <ScoreBar value={d.rawScore} />
            {d.detail && (
              <p className="text-[10px] text-slate-400 font-medium mt-1 leading-tight line-clamp-2">{d.detail}</p>
            )}
          </div>
        ))}
      </div>
      {totalBonus > 0 && (
        <p className="text-[10px] font-bold text-emerald-600 px-0.5">ðŸŽ¯ +{totalBonus}pts bonus applied</p>
      )}
    </div>
  );
}
