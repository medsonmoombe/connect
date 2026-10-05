'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function DeveloperConsultationPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // Scroll chat to bottom whenever detail updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail]);

  const loadDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/consultation-requests/${id}`);
      const d = await res.json();
      if (d.data) {
        setDetail(d.data);
        setExpandedId(id);
        setReplyText('');
      } else {
        toast.error(d.error || 'Could not load request');
      }
    } catch {
      toast.error('Failed to load details');
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
    } else {
      loadDetail(id);
    }
  };

  const handleReply = async () => {
    if (!detail || !replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/consultation-requests/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ developer_reply: replyText.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setReplyText('');
      await loadDetail(detail.id);
      toast.success('Reply sent');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    in_review: requests.filter(r => r.status === 'in_review').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    resolved: requests.filter(r => r.status === 'resolved').length,
  };

  // Build a merged, chronological chat thread from admin notes + developer replies
  const buildThread = (d: any) => {
    const items: { type: 'admin' | 'developer'; text: string; author: string; time: string; internal?: boolean }[] = [];
    for (const n of (d.admin_notes ?? [])) {
      if (n.is_admin_note === true) continue; // skip internal-only notes
      items.push({ type: 'admin', text: n.text, author: n.admin_name || 'Admin', time: n.created_at });
    }
    for (const r of (d.developer_replies ?? [])) {
      items.push({ type: 'developer', text: r.text, author: r.author_name || 'You', time: r.created_at });
    }
    return items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-slate-200 bg-white overflow-hidden">
        <div className="bg-[#0b3b24] px-6 py-5 flex items-center gap-4">
          <div className="size-11 rounded-none bg-white/10 border border-white/15 flex items-center justify-center">
            <Icons.headphones className="size-5 text-emerald-200" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-emerald-200/50 uppercase tracking-widest">Developer Workspace</p>
            <h1 className="text-lg font-bold text-white">Consultation Requests</h1>
            <p className="text-xs text-emerald-100/60 font-medium mt-0.5">Track your requests and communicate with the platform team.</p>
          </div>
          <Link href="/developer/consultation-request" className="h-9 px-4 rounded-none bg-white/10 border border-white/15 text-xs font-bold text-white hover:bg-white/20 transition-colors inline-flex items-center gap-2 shrink-0">
            <Icons.plus className="size-3.5" /> New Request
          </Link>
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

      {/* Accordion List */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-slate-200 bg-white p-4 animate-pulse">
              <div className="h-4 bg-slate-100 w-1/3 mb-2" />
              <div className="h-3 bg-slate-100 w-2/3" />
            </div>
          ))
        ) : requests.length === 0 ? (
          <div className="border border-slate-200 bg-white p-12 text-center">
            <div className="size-12 rounded-none bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Icons.headphones className="size-5 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">No consultation requests</p>
            <p className="text-xs text-slate-400 mb-4">Request help from the platform team when your project needs guidance.</p>
            <Link href="/developer/consultation-request" className="inline-flex items-center gap-2 h-9 px-4 rounded-none bg-green-800 text-white text-xs font-bold hover:bg-green-700 transition-colors">
              <Icons.plus className="size-3.5" /> New Request
            </Link>
          </div>
        ) : (
          requests.map(req => {
            const st = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
            const isOpen = expandedId === req.id;
            const thread = isOpen && detail ? buildThread(detail) : [];

            return (
              <div key={req.id} className={`border bg-white transition-all ${isOpen ? 'border-green-300 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>

                {/* Card Row — click to expand */}
                <button onClick={() => toggleExpand(req.id)} className="w-full text-left p-4 flex items-center gap-3">
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
                      {req.project_paused && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-slate-50 text-slate-500 border-slate-200 shrink-0">
                          <Icons.pause className="inline size-2.5 mr-0.5" />Paused
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{req.message}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <Icons.chevronDown className={`size-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Expanded Content */}
                {isOpen && detail && (
                  <div className="border-t border-slate-100">

                    {/* Info bar */}
                    <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center gap-4 flex-wrap text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><Icons.zap className="size-3" />{detail.project?.technology_type?.replace(/_/g, ' ') || '-'}</span>
                      <span className="flex items-center gap-1.5"><Icons.mapPin className="size-3" />{detail.project?.location_country || '-'}</span>
                      <span className="flex items-center gap-1.5"><Icons.gauge className="size-3" />{detail.project?.project_size_mw ?? '-'} MW</span>
                      {detail.admin && (
                        <span className="flex items-center gap-1.5 ml-auto text-green-700">
                          <Icons.user className="size-3" />Handled by {detail.admin.full_name || detail.admin.email}
                        </span>
                      )}
                      <Link href={`/projects/${req.project_id}`} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors">
                        <Icons.externalLink className="size-3" /> View Project
                      </Link>
                    </div>

                    <div className="p-5 space-y-4">
                      {/* Original request */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Your Request</p>
                        <div className="p-4 border border-slate-200 bg-slate-50 rounded-none">
                          <p className="text-sm text-slate-700 leading-relaxed">{detail.message}</p>
                        </div>
                      </div>

                      {/* Gaps */}
                      {detail.request_details?.gaps?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {detail.request_details.gaps.map((gap: string) => (
                            <span key={gap} className="text-[10px] font-bold px-2.5 py-1 rounded-none border border-amber-200 bg-amber-50 text-amber-700">{gap}</span>
                          ))}
                        </div>
                      )}

                      {/* Chat Thread */}
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Conversation</p>

                        {/* Scrollable thread */}
                        <div className="border border-slate-200 rounded-none overflow-hidden">
                          <div className="max-h-72 overflow-y-auto p-3 space-y-2 bg-slate-50/50">
                            {thread.length === 0 ? (
                              <p className="text-xs text-slate-400 text-center py-6">No messages yet. The platform team will respond here.</p>
                            ) : (
                              thread.map((msg, i) => (
                                <div key={i} className={`flex ${msg.type === 'developer' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[80%] rounded-none px-3 py-2 ${msg.type === 'developer' ? 'bg-green-800 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                                    <div className={`flex items-center gap-1.5 mb-1 ${msg.type === 'developer' ? 'justify-end' : ''}`}>
                                      <span className={`text-[9px] font-bold ${msg.type === 'developer' ? 'text-green-200' : 'text-slate-500'}`}>{msg.author}</span>
                                      <span className={`text-[9px] ${msg.type === 'developer' ? 'text-green-300/60' : 'text-slate-400'}`}>{new Date(msg.time).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs leading-relaxed">{msg.text}</p>
                                  </div>
                                </div>
                              ))
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          {/* Reply input — only on active requests */}
                          {!['resolved', 'cancelled'].includes(detail.status) && (
                            <div className="border-t border-slate-200 p-3 bg-white flex items-end gap-2">
                              <textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); } }}
                                placeholder="Type a message... (Enter to send)"
                                rows={2}
                                className="flex-1 px-3 py-2 rounded-none border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-600/20 resize-none"
                              />
                              <button
                                onClick={handleReply}
                                disabled={submitting || !replyText.trim()}
                                className="h-9 w-9 rounded-none bg-green-800 text-white flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 shrink-0"
                              >
                                {submitting ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.send className="size-3.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Resolution */}
                      {detail.resolution_summary && (
                        <div className="p-4 rounded-none bg-green-50 border border-green-200">
                          <p className="text-[10px] font-bold text-green-700 uppercase tracking-widest mb-1">Resolution</p>
                          <p className="text-xs text-slate-700 leading-relaxed">{detail.resolution_summary}</p>
                          {detail.resolved_at && (
                            <p className="text-[9px] text-green-600 mt-1">Resolved {new Date(detail.resolved_at).toLocaleString()}</p>
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
    </div>
  );
}
