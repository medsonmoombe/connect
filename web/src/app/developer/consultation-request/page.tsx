'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icons } from '@/components/ui/icons';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

function ConsultationRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project');
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [project, setProject] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [pauseProject, setPauseProject] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [gaps, setGaps] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(d => { setProject(d.data); setLoading(false); })
      .catch(() => { toast.error('Project not found'); setLoading(false); });
  }, [projectId]);

  const toggleGap = (gap: string) => {
    setGaps(prev => prev.includes(gap) ? prev.filter(g => g !== gap) : [...prev, gap]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { toast.error('Please describe what help you need'); return; }
    if (!projectId) { toast.error('No project selected'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/consultation-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          message: message.trim(),
          project_paused: pauseProject,
          pause_reason: pauseReason || 'Paused for consultation',
          request_details: { gaps },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      toast.success('Consultation request submitted');
      router.push('/developer/consultation');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!projectId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-8 text-center">
            <div className="size-12 rounded-none bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
              <Icons.alertTriangle className="size-5 text-red-500" />
            </div>
            <p className="text-sm font-bold text-slate-900 mb-1">No Project Selected</p>
            <p className="text-xs text-slate-500 mb-4">Please select a project from your dashboard to request consultation.</p>
            <Link href="/developer" className="inline-flex items-center gap-2 h-10 px-5 rounded-none bg-green-800 text-white text-sm font-bold hover:bg-green-700 transition-colors">
              <Icons.arrowLeft className="size-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6 animate-in fade-in duration-500">
        {/* Back */}
        <Link href="/developer" className="inline-flex items-center justify-center size-9 rounded-none border border-slate-200 bg-white text-slate-500 hover:text-slate-700 transition-colors">
          <Icons.arrowLeft className="size-4" />
        </Link>

        {/* Header */}
        <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="bg-[#0b3b24] px-6 py-5">
            <div className="flex items-center gap-4">
              <div className="size-11 rounded-none bg-white/10 border border-white/15 flex items-center justify-center">
                <Icons.headphones className="size-5 text-emerald-200" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-emerald-200/50 uppercase tracking-widest">Consultation</p>
                <h1 className="text-lg font-bold text-white">Request Consultant Help</h1>
                <p className="text-xs text-emerald-100/60 font-medium mt-0.5">Describe your needs and our team will guide you through documentation and project readiness.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Project Summary */}
        {loading ? (
          <div className="border border-slate-200 bg-white p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 w-1/3" />
              <div className="h-3 bg-slate-100 w-1/2" />
            </div>
          </div>
        ) : project ? (
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6">
            <div className="flex items-center gap-2 mb-3">
              <Icons.folder className="size-4 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Project</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{project.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{project.technology_type?.replace(/_/g, ' ')} · {project.location_country} · {project.project_size_mw} MW</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-none border ${
                  (project.scores?.capital_readiness_score ?? 0) < 40
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : (project.scores?.capital_readiness_score ?? 0) < 70
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  Score: {project.scores?.capital_readiness_score ?? 'N/A'}
                </span>
                <Link href={`/projects/${project.id}`} className="text-xs font-bold text-green-800 hover:underline">
                  View <Icons.externalLink className="inline size-3" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] p-6 text-center">
            <p className="text-sm text-slate-500">Project not found.</p>
          </div>
        )}

        {/* Request Form */}
        <form onSubmit={handleSubmit} className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Your Request</h3>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Describe what help you need for this project.</p>
          </div>
          <div className="p-6 space-y-5">
            {/* Gap Selection */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">What areas need help? (optional)</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Feasibility Study', 'Environmental Assessment', 'Financial Model',
                  'Grid Study', 'Land Title', 'PPA / Offtake',
                  'Permits & Licenses', 'ESIA Report', 'Community Engagement',
                  'Investor Readiness',
                ].map(gap => (
                  <button
                    key={gap}
                    type="button"
                    onClick={() => toggleGap(gap)}
                    className={`h-9 px-3 rounded-none border text-xs font-bold transition-all text-left ${
                      gaps.includes(gap)
                        ? 'border-green-300 bg-green-50 text-green-800'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {gaps.includes(gap) && <Icons.check className="inline size-3 mr-1.5" />}
                    {gap}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Describe your needs *</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g. We need help completing our feasibility study and financial model for a 50MW solar project in Lusaka. We have basic site data but need expert guidance on technical and financial documentation..."
                rows={5}
                required
                className="w-full px-4 py-3 rounded-none border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 resize-none text-sm font-medium"
              />
              <p className="text-[10px] text-slate-400 font-medium">{message.length} / 2000</p>
            </div>

            {/* Pause Option */}
            <div className="rounded-none border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPauseProject(!pauseProject)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${pauseProject ? 'bg-amber-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${pauseProject ? 'translate-x-5' : ''}`} />
                </button>
                <div>
                  <p className="text-xs font-bold text-slate-900">Pause this project while I get help</p>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Your project will be hidden from partners and matchmaking until you resume it.</p>
                </div>
              </div>
              {pauseProject && (
                <div className="mt-3">
                  <input
                    value={pauseReason}
                    onChange={(e) => setPauseReason(e.target.value)}
                    placeholder="Reason for pausing (optional)"
                    className="w-full h-9 px-3 rounded-none border border-amber-200 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex items-center justify-between pt-2">
              <Link href="/developer" className="h-10 px-4 rounded-none border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors inline-flex items-center gap-2">
                <Icons.arrowLeft className="size-3.5" /> Cancel
              </Link>
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="h-10 px-6 rounded-none bg-green-800 text-white text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {submitting ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.send className="size-4" />}
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ConsultationRequestPage() {
  return <Suspense><ConsultationRequestForm /></Suspense>;
}
