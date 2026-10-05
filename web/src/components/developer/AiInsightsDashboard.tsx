'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Project } from '@/types';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { AiInsightsPanel } from '@/components/developer/AiInsightsPanel';
import { getStageRecommendations } from '@/lib/project-stages';
import { scoreAvailability } from '@/lib/score-visibility';

export function AiInsightsDashboard({
  projects,
  selectedProject,
  onSelectProject,
  onReanalyze,
  analyzing,
}: {
  projects: Project[];
  selectedProject: string | null;
  onSelectProject: (id: string) => void;
  onReanalyze: () => void;
  analyzing: boolean;
}) {
  const targetId = selectedProject || projects[0]?.id;
  const project = projects.find((p) => p.id === targetId) || projects[0];

  if (!project) {
    return (
      <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] py-14 flex flex-col items-center text-center">
        <div className="size-14 bg-slate-50 rounded-none flex items-center justify-center mb-4 border border-slate-200">
          <Icons.folder className="size-6 text-slate-300" />
        </div>
        <h4 className="text-sm font-bold text-slate-700 mb-1.5">No Projects</h4>
        <p className="text-xs text-slate-400 font-medium mb-4">Create a project to run AI analysis.</p>
        <Link
          href="/developer/submit"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-none bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors"
        >
          <Icons.plus className="size-3" /> Create Project
        </Link>
      </div>
    );
  }

  // `scores` is nulled by the API whenever the rule withholds it, so its absence
  // has three genuinely different meanings. Collapsing them to `?? 0` is what
  // made this page claim a hidden score was a hard zero.
  const hasScore = !!project.scores;
  const availability = scoreAvailability({
    status: project.status,
    hasRejectionReason: !!project.rejection_reason,
    hasScore,
  });

  const score = project.scores?.capital_readiness_score ?? null;
  const docCount = project.documents?.length ?? 0;

  /**
   * Recommendations come from the stored analysis (`project_scores.recommendations`,
   * written by the AI from the scoring ledger), never from heuristics. The old
   * hardcoded list ("Upload core feasibility documents → +15-25% readiness") and
   * the invented percentile / time-to-close / probability-of-success cards are
   * gone: none of those numbers came from any model, and presenting arithmetic on
   * a stage index as "our AI estimates" is simply false.
   */
  const recommendations = useMemo(() => {
    const stored = project.scores?.recommendations;
    if (!Array.isArray(stored)) return [];
    return stored.filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
  }, [project.scores]);

  const withheld = availability === 'hidden';
  const notRun = availability === 'not_run';
  const running = availability === 'running';

  return (
    <div className="space-y-5">
      {/* ── Project Selector + Re-analyze Bar ── */}
      {projects.length > 1 && (
        <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] px-5 py-3 flex items-center gap-3">
          <Icons.folder className="size-4 text-slate-400 shrink-0" />
          <div className="flex-1">
            <SearchableSelect
              value={targetId || ''}
              onChange={(val) => onSelectProject(val)}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="Select project..."
              className="w-full"
            />
          </div>
          <button
            onClick={onReanalyze}
            disabled={analyzing}
            className="h-9 px-4 rounded-none bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 shrink-0"
          >
            {analyzing ? (
              <Icons.spinner className="size-3.5 animate-spin" />
            ) : (
              <Icons.refreshCw className="size-3.5" />
            )}
            {analyzing ? 'Analyzing...' : 'Re-analyze'}
          </button>
        </div>
      )}

      {/* ── Score availability banner ──
          This page used to render a bold `0%` with a full progress bar and the
          claim "scores higher than 0% of similar projects" whenever the score was
          withheld, i.e. for every project in review. */}
      {(withheld || running) && (
        <div className="rounded-none border border-amber-200 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <Icons.clock className="size-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-amber-900">
              {withheld ? 'Your score is with the regulator' : 'Analysis in progress'}
            </p>
            <p className="text-[11px] text-amber-800 font-medium leading-relaxed mt-0.5">
              {withheld
                ? 'The AI has analysed this project, but the readiness score is released once the regulator approves it or returns it with comments. Nothing is missing — it is just not shown to you yet.'
                : 'This project has been submitted and is being analysed right now. The report appears as soon as the run finishes.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Readiness + Recommendations ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="bg-[#0b3b24] px-4 py-2.5 flex items-center gap-2">
            <Icons.shieldCheck className="size-3.5 text-emerald-200/60" />
            <h4 className="text-[10px] font-bold text-white uppercase tracking-[0.13em]">Readiness Score</h4>
          </div>
          <div className="p-5 space-y-3">
            {score != null ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capital Readiness</span>
                  <span className="text-2xl font-black text-slate-900">{score}<span className="text-sm text-slate-400 font-bold">/100</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 overflow-hidden">
                  <div className="h-full bg-green-800" style={{ width: `${score}%` }} />
                </div>
                <p className="text-[9px] text-slate-400 font-medium">
                  Scored from {docCount} uploaded {docCount === 1 ? 'document' : 'documents'}. The breakdown of every rating is below.
                </p>
              </>
            ) : (
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {running
                  ? 'The analysis is still running.'
                  : withheld
                    ? 'Withheld until the regulator has reviewed this project.'
                    : 'No analysis has completed for this project yet.'}
              </p>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="bg-[#0b3b24] px-4 py-2.5 flex items-center gap-2">
            <Icons.lightbulb className="size-3.5 text-emerald-200/60" />
            <h4 className="text-[10px] font-bold text-white uppercase tracking-[0.13em]">Recommended Next Steps</h4>
          </div>
          <div className="p-5 space-y-3">
            {recommendations.length > 0 ? (
              recommendations.slice(0, 5).map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="size-5 rounded-none flex items-center justify-center shrink-0 mt-0.5 bg-green-50 border border-green-100 text-green-700">
                    <Icons.check className="size-2.5" />
                  </div>
                  <p className="text-[10px] font-medium text-slate-700 leading-relaxed">{rec}</p>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {hasScore
                  ? 'The analysis did not produce any next steps.'
                  : 'No next steps until an analysis has completed.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Recommended Profiles to Contact ── */}
      {(() => {
        const recs = getStageRecommendations(project.project_stage);
        if (recs.partnerTypes.length === 0) return null;
        return (
          <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.13em]">Recommended Next</p>
                <h3 className="text-[15px] font-bold text-ink mt-0.5">Profiles to Contact at {project.project_stage?.replace(/_/g, ' ')}</h3>
              </div>
              <Link
                href={`/developer/find-partners?project=${project.id}`}
                className="text-[10px] font-bold text-g-700 hover:text-g-900 tracking-widest transition-colors"
              >
                Find Partners →
              </Link>
            </div>
            <div className="p-5 flex flex-wrap gap-3">
              {recs.partnerTypes.map((pt) => (
                <div
                  key={pt}
                  className="flex items-center gap-3 px-4 py-3 rounded-none bg-green-50 border border-green-200"
                >
                  <div className="size-8 rounded-none bg-green-100 border border-green-200 flex items-center justify-center">
                    <Icons.users className="size-4 text-green-700" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-green-800">{pt}</p>
                    <p className="text-[9px] text-green-600 font-medium">
                      {recs.services.length > 0 ? `Services: ${recs.services.slice(0, 2).map(s => s.replace(/_/g, ' ')).join(', ')}` : 'Recommended for this stage'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Detailed Analysis Panel ── */}
      <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
        <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.13em]">Detailed Analysis</p>
          <h3 className="text-[15px] font-bold text-ink mt-0.5">Document Checker + Readiness Engine + Risk Engine</h3>
        </div>
        <div className="p-6">
          <AiInsightsPanel
            project={project}
            scores={project.scores ?? null}
            onReanalyze={onReanalyze}
            analyzing={analyzing}
            emptyCopy={
              withheld
                ? {
                    title: 'Withheld pending regulator review',
                    hint: 'The analysis is complete. Your score is released once the regulator approves the project or returns it with comments.',
                  }
                : {
                    title: 'No AI Analysis Yet',
                    hint: 'Run AI document analysis to generate readiness scores, risk assessment, and recommendations.',
                  }
            }
          />
        </div>
      </div>
    </div>
  );
}