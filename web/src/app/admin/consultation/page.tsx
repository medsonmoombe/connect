'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/ui/icons';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: 'Pending',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  in_review:   { label: 'In Review',   color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  in_progress: { label: 'In Progress', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  resolved:    { label: 'Resolved',    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  cancelled:   { label: 'Cancelled',   color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

export default function AdminConsultationPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isPublicNote, setIsPublicNote] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [showResolve, setShowResolve] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`/api/consultation-requests${params}`);
      const d = await res.json();
      setRequests(d.data ?? []);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { loadRequests(); }, [filter]);

  const loadDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/consultation-requests/${id}`);
      const d = await res.json();
      if (d.data) {
        setSelected(d.data);
        setExpandedId(id);
      } else {
        toast.error(d.error || 'Could not load request');
      }
    } catch {
      toast.error('Failed to load request details');
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setSelected(null);
    } else {
      loadDetail(id);
    }
  };

  const handleAction = async (id: string, body: Record<string, any>) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultation-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      toast.success('Updated');
      await loadDetail(id);
      await loadRequests();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddNote = async () => {
    if (!selected || !noteText.trim()) return;
    await handleAction(selected.id, { note: noteText.trim(), is_admin_note: !isPublicNote });
    setNoteText('');
  };

  const handleResolve = async () => {
    if (!selected || !resolutionSummary.trim()) return;
    await handleAction(selected.id, { status: 'resolved', resolution_summary: resolutionSummary.trim() });
    setShowResolve(false);
    setResolutionSummary('');
  };

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_review: requests.filter(r => r.status === 'in_review').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-4 border-b border-line bg-white px-[22px] py-[17px]">
          <div className="grid size-11 place-items-center rounded-none bg-brand-soft text-brand-text">
            <Icons.headphones className="size-5 text-g-700" />
          </div>
          <div>
            <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Admin Panel</p>
            <h1 className="text-lg font-bold text-ink">Consultation Requests</h1>
            <p className="text-xs text-g-600 font-medium mt-0.5">Manage developer consultation requests and guide them to project readiness.</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Pending',     value: counts.pending,     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  icon: Icons.clock },
          { label: 'In Review',   value: counts.in_review,   color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   icon: Icons.eye },
          { label: 'In Progress', value: counts.in_progress, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: Icons.spinner },
          { label: 'Resolved',    value: counts.resolved,    color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  icon: Icons.checkCircle2 },
        ].map(s => (
          <div key={s.label} className={`border ${s.border} ${s.bg} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`size-3.5 ${s.color}`} />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</span>
            </div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['all', 'pending', 'in_review', 'in_progress', 'resolved'] as const).map(f => {
          const cfg = f === 'all' ? { label: 'All', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' } : STATUS_CONFIG[f];
          return (
            <button key={f} onClick={() => setFilter(f)} className={`h-8 px-3 rounded-none border text-[10px] font-bold tracking-wider uppercase transition-all flex items-center gap-1.5 shrink-0 ${filter === f ? `${cfg.bg} ${cfg.color} ${cfg.border}` : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
              {cfg.label} <span className="text-[9px] opacity-60">({counts[f as keyof typeof counts]})</span>
            </button>
          );
        })}
      </div>

      {/* Request List — accordion style */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-slate-200 bg-white p-4 animate-pulse">
              <div className="h-4 bg-slate-100 w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 w-2/3" />
            </div>
          ))
        ) : requests.length === 0 ? (
          <div className="border border-slate-200 bg-white p-10 text-center">
            <Icons.checkCircle2 className="size-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-400">No consultation requests</p>
          </div>
        ) : (
          requests.map(req => {
            const st = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            const isOpen = expandedId === req.id;
            const detail = isOpen ? selected : null;

            return (
              <div key={req.id} className={`border bg-white transition-all ${isOpen ? 'border-green-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                {/* Card Row */}
                <button
                  onClick={() => toggleExpand(req.id)}
                  className="w-full text-left p-4 flex items-center gap-3"
                >
                  <div className={`size-9 rounded-none flex items-center justify-center shrink-0 ${isOpen ? 'bg-green-100' : 'bg-slate-100'}`}>
                    {req.status === 'resolved'
                      ? <Icons.checkCircle2 className="size-4 text-green-600" />
                      : req.status === 'in_progress'
                        ? <Icons.spinner className="size-4 text-violet-600" />
                        : req.status === 'in_review'
                          ? <Icons.eye className="size-4 text-blue-500" />
                          : <Icons.clock className="size-4 text-amber-500" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-slate-900 truncate">{req.project?.name || 'Unknown Project'}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${st.bg} ${st.color} ${st.border}`}>{st.label}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{req.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <Icons.chevronDown className={`size-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded Detail */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 mr-2">Actions</span>

                      {!detail?.admin_id && (
                        <button onClick={() => handleAction(req.id, { assign_to_self: true })} disabled={submitting} className="h-8 px-3 rounded-none bg-white/10 border border-white/20 text-[10px] font-bold text-white hover:bg-white/20 transition-colors inline-flex items-center gap-1.5">
                          <Icons.user className="size-3" /> Assign to Me
                        </button>
                      )}

                      {detail?.admin_id && (
                        <span className="text-[10px] text-g-600 font-medium">
                          Assigned to {detail.admin?.full_name || 'Admin'}
                        </span>
                      )}

                      {!['resolved', 'cancelled'].includes(req.status) && (
                        <>
                          {req.status !== 'in_review' && (
                            <button onClick={() => handleAction(req.id, { status: 'in_review' })} disabled={submitting} className="h-8 px-3 rounded-none bg-blue-500/80 text-[10px] font-bold text-white hover:bg-blue-600 transition-colors inline-flex items-center gap-1.5">
                              <Icons.eye className="size-3" /> In Review
                            </button>
                          )}
                          {req.status !== 'in_progress' && (
                            <button onClick={() => handleAction(req.id, { status: 'in_progress' })} disabled={submitting} className="h-8 px-3 rounded-none bg-violet-500/80 text-[10px] font-bold text-white hover:bg-violet-600 transition-colors inline-flex items-center gap-1.5">
                              <Icons.spinner className="size-3" /> In Progress
                            </button>
                          )}
                          <button onClick={() => setShowResolve(true)} disabled={submitting} className="h-8 px-3 rounded-none bg-green-500/80 text-[10px] font-bold text-white hover:bg-green-600 transition-colors inline-flex items-center gap-1.5">
                            <Icons.checkCircle2 className="size-3" /> Resolve
                          </button>
                          <button onClick={() => { if (confirm('Cancel this request?')) handleAction(req.id, { status: 'cancelled' }); }} disabled={submitting} className="h-8 px-3 rounded-none bg-red-500/80 text-[10px] font-bold text-white hover:bg-red-600 transition-colors inline-flex items-center gap-1.5">
                            <Icons.x className="size-3" /> Cancel
                          </button>
                        </>
                      )}

                      <Link href={`/projects/${req.project_id}`} className="ml-auto h-8 px-3 rounded-none bg-white/10 border border-white/20 text-[10px] font-bold text-white hover:bg-white/20 transition-colors inline-flex items-center gap-1.5">
                        <Icons.externalLink className="size-3" /> View Project
                      </Link>
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Project Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Technology', value: req.project?.technology_type?.replace(/_/g, ' ') || '-', icon: Icons.zap },
                          { label: 'Location',   value: req.project?.location_country || '-',                    icon: Icons.mapPin },
                          { label: 'Capacity',   value: `${req.project?.project_size_mw ?? '-'} MW`,             icon: Icons.gauge },
                          { label: 'Status',     value: req.project?.status || '-',                              icon: Icons.barChart3 },
                        ].map(item => (
                          <div key={item.label} className="border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center gap-1.5 mb-1">
                              <item.icon className="size-3 text-slate-400" />
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</span>
                            </div>
                            <p className="text-xs font-bold text-slate-900">{item.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Developer Message */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Developer&apos;s Request</p>
                        <div className="p-4 border border-slate-200 bg-slate-50 rounded-none">
                          <p className="text-sm text-slate-700 leading-relaxed">{req.message}</p>
                        </div>
                      </div>

                      {/* Gaps */}
                      {req.request_details?.gaps?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Areas Needing Help</p>
                          <div className="flex flex-wrap gap-1.5">
                            {req.request_details.gaps.map((gap: string) => (
                              <span key={gap} className="text-[10px] font-bold px-2.5 py-1 rounded-none border border-amber-200 bg-amber-50 text-amber-700">{gap}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Developer Replies */}
                      {detail && Array.isArray(detail.developer_replies) && detail.developer_replies.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Developer Replies</p>
                          <div className="space-y-2">
                            {detail.developer_replies.map((reply: any, i: number) => (
                              <div key={i} className="p-3 rounded-none border border-blue-100 bg-blue-50/40">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="size-5 rounded-full bg-blue-600 flex items-center justify-center">
                                    <span className="text-[8px] font-bold text-white">{(reply.author_name || 'D')[0]}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-blue-800">{reply.author_name || 'Developer'}</span>
                                  <span className="text-[9px] text-slate-400">{new Date(reply.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-slate-700 ml-7">{reply.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes Thread */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notes & Communication</p>
                        {detail && Array.isArray(detail.admin_notes) && detail.admin_notes.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {detail.admin_notes.map((note: any, i: number) => (
                              <div key={i} className={`p-3 rounded-none border ${note.is_admin_note !== false ? 'bg-slate-50 border-slate-200' : 'bg-green-50/50 border-green-100'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`size-5 rounded-full flex items-center justify-center ${note.is_admin_note !== false ? 'bg-slate-200' : 'bg-green-800'}`}>
                                    <span className={`text-[8px] font-bold ${note.is_admin_note !== false ? 'text-slate-600' : 'text-white'}`}>{(note.admin_name || 'A')[0]}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-700">{note.admin_name || 'Admin'}</span>
                                  {note.is_admin_note === false && <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">Visible to developer</span>}
                                  <span className="text-[9px] text-slate-400">{new Date(note.created_at).toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-slate-700 ml-7">{note.text}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mb-3">No notes yet.</p>
                        )}

                        {/* Note Input */}
                        {!['resolved', 'cancelled'].includes(req.status) && (
                          <div className="border border-slate-200 rounded-none p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <button onClick={() => setIsPublicNote(true)} className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${isPublicNote ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}>Developer Note</button>
                              <button onClick={() => setIsPublicNote(false)} className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${!isPublicNote ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-200 text-slate-500'}`}>Internal Only</button>
                            </div>
                            <textarea
                              value={noteText}
                              onChange={(e) => setNoteText(e.target.value)}
                              placeholder={isPublicNote ? 'Add a note visible to the developer...' : 'Internal admin note (not visible to developer)...'}
                              rows={3}
                              className="w-full px-3 py-2 rounded-none border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600/20 resize-none"
                            />
                            <div className="flex justify-end mt-2">
                              <button onClick={handleAddNote} disabled={submitting || !noteText.trim()} className="h-8 px-4 rounded-none bg-green-800 text-white text-[10px] font-bold hover:bg-green-700 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5">
                                {submitting ? <Icons.spinner className="size-3 animate-spin" /> : <Icons.send className="size-3" />}
                                Add Note
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Resolution Summary */}
                      {detail?.resolution_summary && (
                        <div className="p-4 rounded-none bg-green-50 border border-green-200">
                          <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Resolution Summary</p>
                          <p className="text-xs text-slate-700">{detail.resolution_summary}</p>
                          {detail.resolved_at && <p className="text-[9px] text-green-600 mt-1">Resolved {new Date(detail.resolved_at).toLocaleString()}</p>}
                        </div>
                      )}

                      {/* Pause / Resume */}
                      {!['resolved', 'cancelled'].includes(req.status) && (
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          {req.project?.status !== 'paused' ? (
                            <button
                              onClick={async () => {
                                if (!confirm('Pause this project?')) return;
                                const res = await fetch(`/api/projects/${req.project_id}/pause`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pause_reason: 'Paused by admin during consultation' }) });
                                const d = await res.json();
                                if (res.ok) { toast.success('Project paused'); loadDetail(req.id); loadRequests(); } else { toast.error(d.error); }
                              }}
                              className="h-8 px-3 rounded-none border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold hover:bg-amber-100 transition-colors inline-flex items-center gap-1.5"
                            >
                              <Icons.pause className="size-3" /> Pause Project
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (!confirm('Resume this project?')) return;
                                const res = await fetch(`/api/projects/${req.project_id}/resume`, { method: 'POST' });
                                const d = await res.json();
                                if (res.ok) { toast.success('Project resumed'); loadDetail(req.id); loadRequests(); } else { toast.error(d.error); }
                              }}
                              className="h-8 px-3 rounded-none border border-green-200 bg-green-50 text-green-700 text-[10px] font-bold hover:bg-green-100 transition-colors inline-flex items-center gap-1.5"
                            >
                              <Icons.play className="size-3" /> Resume Project
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Resolve Modal */}
      {showResolve && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowResolve(false)}>
          <div className="w-full max-w-md bg-white rounded-none shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
              <div>
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">Resolve Request</p>
                <h2 className="text-sm font-bold text-ink">{selected.project?.name}</h2>
              </div>
              <button onClick={() => setShowResolve(false)} className="grid size-8 place-items-center rounded-none bg-surface-2 text-ink-3 hover:text-ink">
                <Icons.x className="size-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Resolution Summary *</label>
                <textarea
                  value={resolutionSummary}
                  onChange={(e) => setResolutionSummary(e.target.value)}
                  placeholder="Summarize what was done to help the developer..."
                  rows={4}
                  className="w-full mt-2 px-4 py-3 rounded-none border border-slate-200 bg-slate-50 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600/20 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowResolve(false)} className="h-10 px-4 rounded-none border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleResolve} disabled={submitting || !resolutionSummary.trim()} className="h-10 px-6 rounded-none bg-green-800 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-50 inline-flex items-center gap-2">
                  {submitting ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.checkCircle2 className="size-4" />}
                  Mark Resolved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
