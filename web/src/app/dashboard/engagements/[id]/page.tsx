'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Engagement } from '@/types';
import { engagementService, getStateLabel, getTransitionsForRole, getStateProgress, type TransitionRole } from '@/lib/engagement';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { EngagementMilestones } from '@/components/EngagementMilestones';
import type { EngagementStateEntry } from '@/components/EngagementMilestones';
import { EngagementDataRoom } from '@/components/engagement/EngagementDataRoom';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, XCircle, Send, Shield, FileText, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { messagesApi } from '@/services/api';

interface Message {
  id: string;
  engagement_id: string;
  sender_id: string;
  message_body: string;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  sender?: { id: string; full_name: string | null; avatar_url: string | null };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  INTRO_SENT:        { label: 'Introduction Sent',    color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  INTRO_ACCEPTED:    { label: 'Introduction Accepted', color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  NDA_SIGNED:        { label: 'NDA Signed',           color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
  DUE_DILIGENCE:     { label: 'Due Diligence',        color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  TERM_SHEET:        { label: 'Term Sheet',           color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
  CONTRACT_SIGNED:   { label: 'Contract Signed',      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { label: 'Capital Committed',    color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CLOSED:            { label: 'Closed',               color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  DROPPED:           { label: 'Dropped',              color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100' },
};

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32 rounded-lg" />
      <Skeleton className="h-56 rounded-2xl" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-44 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function EngagementRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const engagementId = params.id as string;

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [stateHistory, setStateHistory] = useState<EngagementStateEntry[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!engagementId) return;
    async function load() {
      try {
        const engData = await engagementService.getEngagement(engagementId);
        setEngagement(engData);
      } catch {
        setError('Failed to load engagement.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [engagementId]);

  // Fetch the structured transition history (PRD §J) for the milestone timeline.
  const loadStateHistory = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await apiClient.get<{ data: { states: EngagementStateEntry[] } }>(`/engagements/${engagementId}/audit`);
      setStateHistory(res?.data?.states ?? []);
    } catch {
      // Non-fatal — milestones still render from the live status.
    }
  }, [engagementId]);

  useEffect(() => { loadStateHistory(); }, [loadStateHistory]);

  // Load messages separately — failure shouldn't block the engagement page
  useEffect(() => {
    if (!engagementId) return;
    let cancelled = false;
    async function loadMessages() {
      try {
        const msgRes = await apiClient.get<{ data: Message[] }>(`/messages?engagement_id=${engagementId}`);
        if (cancelled) return;
        setMessages(msgRes.data ?? []);
      } catch {
        // Messages failed to load — page still works, just no messages
      }
    }
    loadMessages();
    // The realtime effect (below) also marks-as-read on subscribe; we trigger
    // a read mark here too so returning users clear unread immediately.
    messagesApi.markRead(engagementId).catch(() => {});
    return () => { cancelled = true; };
  }, [engagementId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!engagementId) return;
    const supabase = createClient();
    setRealtimeStatus('connecting');

    // Helper: build a Message row from a realtime payload. The payload's `new`
    // row carries raw columns (no joined `sender`), so we synthesize sender from
    // the current authenticated user or a neutral fallback. This keeps the chat
    // updating live WITHOUT a round-trip; a fuller sender object is reconciled
    // on the next full GET (e.g. when the room is revisited).
    const materialize = (row: any): Message => ({
      id: row.id,
      engagement_id: row.engagement_id ?? engagementId,
      sender_id: row.sender_id,
      message_body: row.message_body ?? '',
      created_at: row.created_at ?? new Date().toISOString(),
      deleted_at: row.deleted_at ?? null,
      deleted_by: row.deleted_by ?? null,
      sender: row.sender_id === user?.id
        ? { id: user?.id ?? '', full_name: user?.full_name ?? null, avatar_url: user?.avatar_url ?? null }
        : undefined,
    });

    // ── Messages realtime ──────────────────────────────────────────────────
    // Key fix: append payload.new directly after a dedupe-by-id check.
    // The previous implementation returned `prev` in BOTH dedupe branches and
    // relied on a silent re-fetch that swallowed errors — so messages rarely
    // appeared live. We now treat the realtime payload as the source of truth.
    const messageChannel = supabase
      .channel(`messages:${engagementId}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `engagement_id=eq.${engagementId}` },
        (payload) => {
          const msg = materialize(payload.new as any);
          setMessages(prev => {
            // Already have this exact row (e.g. partner's message we already
            // appended, or a re-delivery) — keep existing.
            if (prev.some(m => m.id === msg.id)) return prev;

            // If this is the SENDER's own insert arriving over realtime, it
            // corresponds to the optimistic row we added on send. Replace the
            // optimistic placeholder (id starts with "optimistic-") with the
            // authoritative server row so timestamps/ids are correct.
            if (msg.sender_id === user?.id) {
              const optIdx = prev.findIndex(m => m.id.startsWith('optimistic-'));
              if (optIdx !== -1) {
                const copy = [...prev];
                copy[optIdx] = msg;
                return copy;
              }
            }
            return [...prev, msg];
          });
          // If the incoming message is from the other party, mark the
          // engagement read so unread counters stay accurate while the room
          // is open and focused.
          if (msg.sender_id !== user?.id) {
            messagesApi.markRead(engagementId).catch(() => {});
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `engagement_id=eq.${engagementId}` },
        (payload) => {
          const row = payload.new as any;
          // A soft-delete UPDATE sets deleted_at → drop the local row.
          if (row?.deleted_at) {
            setMessages(prev => prev.filter(m => m.id !== row.id));
            return;
          }
          // Otherwise reconcile any changed body/tombstone.
          setMessages(prev => prev.map(m => (m.id === row.id ? { ...m, ...materialize(row) } : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `engagement_id=eq.${engagementId}` },
        (payload) => {
          const old = payload.old as any;
          if (!old?.id) return;
          setMessages(prev => prev.filter(m => m.id !== old.id));
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected');
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeStatus('disconnected');
      });

    // ── Engagement status realtime ─────────────────────────────────────────
    // Push live status changes (intro accepted, milestones advanced) so the
    // room updates without a manual refetch. Migration 038 publishes
    // `engagements` to the realtime publication.
    const engChannel = supabase
      .channel(`engagement:${engagementId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'engagements', filter: `id=eq.${engagementId}` },
        (payload) => {
          const updated = payload.new as any;
          setEngagement(prev => prev ? ({ ...prev, status: updated?.status ?? prev.status } as any) : prev);
        }
      )
      .subscribe();

    return () => {
      setRealtimeStatus('disconnected');
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(engChannel);
    };
  }, [engagementId, user?.id, user?.full_name, user?.email, user?.avatar_url]);

  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;
    setSending(true);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      engagement_id: engagementId,
      sender_id: user?.id ?? '',
      message_body: content,
      created_at: new Date().toISOString(),
      sender: { id: user?.id ?? '', full_name: user?.full_name ?? null, avatar_url: user?.avatar_url ?? null },
    };
    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');
    try {
      const res = await apiClient.post<{ data: Message }>('/messages', { engagement_id: engagementId, content });
      setMessages(prev => prev.map(m => m.id === optimisticId ? res.data : m));
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setNewMessage(content);
      toast.error(err?.message || 'Failed to send message');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // PRD §11.1 — users may delete their OWN messages within 5 minutes.
  const SELF_DELETE_WINDOW_MS = 5 * 60_000;
  const canDeleteMessage = (msg: Message) =>
    msg.sender_id === user?.id &&
    !msg.deleted_at &&
    !msg.id.startsWith('optimistic-') &&
    (Date.now() - new Date(msg.created_at).getTime()) <= SELF_DELETE_WINDOW_MS;

  const handleDeleteMessage = async (msgId: string) => {
    // Optimistic removal — backend soft-deletes; realtime UPDATE will confirm.
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      await messagesApi.remove(msgId);
      toast.success('Message deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete message');
      // Re-load to restore on failure
      const msgRes = await apiClient.get<{ data: Message[] }>(`/messages?engagement_id=${engagementId}`);
      setMessages(msgRes.data ?? []);
    }
  };

  const handleStatusUpdate = async (nextStatus: any) => {
    if (!engagement) return;
    setUpdating(true);
    try {
      await engagementService.updateStatus(engagement.id, nextStatus);
      const updated = await engagementService.getEngagement(engagement.id);
      setEngagement(updated);
      loadStateHistory();
      toast.success(`Engagement moved to ${getStateLabel(nextStatus)}`);
    } catch (e: any) {
      // Precondition / role / invalid-transition errors come back with a
      // meaningful message — surface it rather than a generic toast.
      toast.error(e?.message || 'Failed to update engagement status');
    } finally {
      setUpdating(false);
    }
  };

  const handleDrop = async () => {
    setShowDropConfirm(false);
    if (!engagement) return;
    setUpdating(true);
    try {
      await engagementService.updateStatus(engagement.id, 'DROPPED');
      const updated = await engagementService.getEngagement(engagement.id);
      setEngagement(updated);
      loadStateHistory();
      toast.success('Engagement dropped');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to drop engagement');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <PageSkeleton />
      </div>
    );
  }

  if (error || !engagement) {
    return (
      <div className="max-w-6xl mx-auto py-20 text-center">
        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Icons.messageSquare className="size-8 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Engagement Not Found</h2>
        <p className="text-sm text-slate-500 mb-6">{error || "This engagement doesn't exist or you don't have access."}</p>
        <Button onClick={() => router.back()} className="h-10 px-6 rounded-xl">Back to Dashboard</Button>
      </div>
    );
  }

  const isDeveloper = user?.company_id === (engagement.project as any)?.developer_id;
  const isAdmin = user?.role === 'ADMIN';
  const counterpartyCompanyId = (engagement as any).counterparty_company_id as string | undefined;
  const isCounterparty = !isDeveloper && !!counterpartyCompanyId && user?.company_id === counterpartyCompanyId;
  const userRole: TransitionRole | null = isDeveloper ? 'developer' : isCounterparty ? 'counterparty' : null;
  const nextStates = getTransitionsForRole(engagement.status, userRole);
  const isTerminal = engagement.status === 'DROPPED' || engagement.status === 'CLOSED';

  // PRD §10.2 precondition hints — tell the user what's required to advance.
  const transitionHint = (() => {
    if (isAdmin) return null;
    switch (`${engagement.status}`) {
      case 'INTRO_ACCEPTED':
        return nextStates.includes('NDA_SIGNED')
          ? 'Sign the NDA (offline for MVP) and advance to record it. Upload the NDA to the data room for an audit trail.'
          : null;
      case 'DUE_DILIGENCE':
        return nextStates.includes('TERM_SHEET')
          ? 'The counter party must review the shared data-room documents before a term sheet can be issued.'
          : null;
      case 'TERM_SHEET':
        return nextStates.includes('CONTRACT_SIGNED')
          ? 'Upload a signed term sheet / contract draft to the engagement data room to move to Contract Signed.'
          : null;
      default:
        return null;
    }
  })();
  const progress = getStateProgress(engagement.status);
  const counterpartyCompany = (engagement as any).counterparty_company;
  const canSeeDataRoom = !['INTRO_SENT', 'INTRO_ACCEPTED'].includes(engagement.status);
  const st = STATUS_CONFIG[engagement.status] || STATUS_CONFIG.INTRO_SENT;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

      {/* ── Back Nav ─────────────────────────────────── */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest">
        <Icons.arrowLeft className="size-3.5" /> Back
      </button>

      {/* ── Hero Card ────────────────────────────────── */}
      <div className="dash-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-bl-[160px] -z-10" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
          <div className="flex-1">
            {/* Status Badge */}
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border mb-4", st.bg, st.color, st.border)}>
              <span className="size-1.5 rounded-full bg-current" />
              {st.label}
            </span>

            {/* Project Name */}
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-2">
              {engagement.project?.name || 'Untitled Project'}
            </h1>

            {/* Meta Pills */}
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                <Icons.messageSquare className="size-3 text-primary" /> Engagement Room
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                <Icons.layers className="size-3 text-primary" /> {engagement.id.substring(0, 8)}
              </span>
              {engagement.counterparty_type && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                  <Icons.building className="size-3 text-primary" /> {engagement.counterparty_type === 'CAPITAL' ? 'Capital Partner' : 'Technical Partner'}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100 text-xs font-bold text-slate-700">
                <Icons.clock className="size-3 text-primary" /> {new Date(engagement.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Milestones */}
        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
          <EngagementMilestones currentStatus={engagement.status} history={stateHistory} />
        </div>

        {/* Progress bar */}
        {!isTerminal && (
          <div className="mt-6 pt-6 border-t border-slate-100">
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              <span>Deal Progress</span><span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Left: Actions + Messaging ──────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Action Panel */}
          {!isTerminal && (
            <div className="dash-card p-6">
              <h3 className="dash-section-label mb-5 flex items-center gap-2">
                <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.zap className="size-3 text-primary" /></div>
                Strategic Actions
              </h3>

              {engagement.status === 'INTRO_SENT' && isDeveloper && (
                <div className="bg-slate-900 text-white p-7 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">New Introduction Request</p>
                    <p className="text-sm font-semibold text-white/90 mb-6 leading-relaxed">
                      A capital partner has expressed interest in your project. Accept to reveal contact details and begin the NDA process.
                    </p>
                    <div className="flex gap-3">
                      <Button onClick={() => handleStatusUpdate('INTRO_ACCEPTED')} disabled={updating}
                        className="h-9 px-6 rounded-xl font-bold text-xs"
                        icon={updating ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.check className="size-3.5" />}>
                        Accept Introduction
                      </Button>
                      <Button variant="outline" onClick={() => setShowDropConfirm(true)} disabled={updating}
                        className="h-9 px-6 rounded-xl border-white/20 text-green-500 hover:bg-red/10 font-bold text-xs bg-red-50/5 hover:text-red-600 transition-colors">
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {engagement.status === 'INTRO_SENT' && !isDeveloper && (
                <div className="p-5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4">
                  <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Icons.clock className="size-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900 mb-1">Introduction Sent — Awaiting Response</p>
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      The developer has been notified. You will receive an email and in-app notification once they respond.
                    </p>
                  </div>
                </div>
              )}

              {engagement.status !== 'INTRO_SENT' && nextStates.length > 0 && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 font-medium">Advance the deal milestone as you progress through the workflow:</p>
                  {transitionHint && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-2.5">
                      <Shield className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[11px] font-medium text-amber-800 leading-relaxed">{transitionHint}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {nextStates.map(state => (
                      <Button key={state} onClick={() => state === 'DROPPED' ? setShowDropConfirm(true) : handleStatusUpdate(state)} disabled={updating}
                        variant={state === 'DROPPED' ? 'outline' : 'default'}
                        className={cn('h-9 px-5 rounded-xl font-bold text-xs',
                          state === 'DROPPED' ? 'border-red-200 text-red-600 hover:bg-red-50' : ''
                        )}
                        icon={updating ? <Icons.spinner className="size-3.5 animate-spin" /> : undefined}>
                        {state === 'DROPPED' ? 'Drop Engagement' : `Move to ${getStateLabel(state)}`}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {engagement.status !== 'INTRO_SENT' && nextStates.length === 0 && (
                <div className="p-5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-4">
                  <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Icons.clock className="size-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900 mb-1">Awaiting Other Party</p>
                    <p className="text-xs text-amber-700 font-medium leading-relaxed">
                      This milestone is waiting for the {isDeveloper ? 'partner' : 'developer'} to take action.
                      You will be notified once they respond.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Terminal states */}
          {engagement.status === 'CLOSED' && (
            <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-2xl flex flex-col items-center text-center">
              <div className="size-16 bg-white rounded-full flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
                <CheckCircle className="size-8" />
              </div>
              <h3 className="text-xl font-bold text-emerald-900 mb-1">Deal Closed</h3>
              <p className="text-emerald-700 font-medium text-sm">This engagement has reached Financial Close.</p>
            </div>
          )}

          {engagement.status === 'DROPPED' && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <XCircle className="size-8 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Engagement Terminated</p>
            </div>
          )}

          {/* Live Messaging */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden flex flex-col" style={{ minHeight: '480px' }}>
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                <span className={cn(
                  'size-1.5 rounded-full',
                  realtimeStatus === 'connected' ? 'bg-green-500 animate-pulse' :
                    realtimeStatus === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                )} /> Live Messaging
              </span>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                {realtimeStatus} · {messages.length} messages
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ maxHeight: '360px' }}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                    <Icons.messageSquare className="size-6 text-slate-300" />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No messages yet</p>
                  <p className="text-[11px] text-slate-400 mt-1">Start the conversation below</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isOwn = msg.sender_id === user?.id;
                  const senderName = msg.sender?.full_name ?? (isOwn ? 'You' : 'Partner');
                  const initials = senderName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
                  const canDelete = canDeleteMessage(msg);
                  return (
                    <div key={msg.id} className={cn('group flex gap-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
                      <div className={cn(
                        'size-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0',
                        isOwn ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
                      )}>
                        {initials}
                      </div>
                      <div className={cn('max-w-[70%] space-y-1')}>
                        <div className={cn('relative', isOwn ? 'flex justify-end' : '')}>
                          <div className={cn(
                            'px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed',
                            isOwn
                              ? 'bg-primary text-white rounded-tr-sm'
                              : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-sm'
                          )}>
                            {msg.message_body}
                          </div>
                          {canDelete && (
                            <button
                              type="button"
                              aria-label="Delete message"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className={cn(
                                'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity',
                                'size-6 rounded-full bg-white/90 hover:bg-red-50 border border-slate-200 shadow-sm',
                                'flex items-center justify-center text-slate-400 hover:text-red-600',
                                isOwn ? '-left-7' : '-right-7'
                              )}
                            >
                              <Icons.trash className="size-3" />
                            </button>
                          )}
                        </div>
                        <p className={cn('text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1', isOwn ? 'text-right' : 'text-left')}>
                          {senderName} · {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/30">
              <div className="flex gap-3 items-end">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  style={{ maxHeight: '120px' }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  className="h-11 w-11 rounded-xl bg-primary text-white p-0 shrink-0 hover:scale-105 transition-all shadow-lg shadow-primary/20"
                >
                  {sending ? <Icons.spinner className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ───────────────────────────── */}
        <div className="space-y-6">

          {/* Counterparty Card */}
          <div className="p-6 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-bl-[80px]" />
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
              {isDeveloper ? 'Capital Partner' : 'Project Developer'}
            </p>
            {counterpartyCompany ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {counterpartyCompany.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{counterpartyCompany.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                      {engagement.counterparty_type === 'CAPITAL' ? 'Capital Partner' : 'Technical Partner'}
                    </p>
                  </div>
                </div>
                {counterpartyCompany.website && (
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/10 p-3 rounded-xl">
                    <span className="text-slate-400">Website</span>
                    <a href={counterpartyCompany.website} target="_blank" rel="noopener noreferrer"
                      className="hover:text-primary transition-colors">
                      {counterpartyCompany.website.replace(/^https?:\/\//, '').substring(0, 25)}
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-white/5 rounded-xl border border-dashed border-white/10 text-center">
                <Icons.lock className="size-5 mx-auto text-slate-500 mb-2" />
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {engagement.status === 'INTRO_SENT'
                    ? 'Contact revealed after acceptance'
                    : 'Loading counterparty info...'}
                </p>
              </div>
            )}
          </div>

          {/* Data Room — project documents shortcut + live engagement docs */}
          {canSeeDataRoom && (
            <div className="dash-card p-6">
              <h3 className="dash-section-label mb-4 flex items-center gap-2">
                <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.fileText className="size-3 text-primary" /></div>
                Project Documents
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mb-3">
                Browse the developer's shared project documents opened for this engagement.
              </p>
              <Button
                variant="outline"
                className="w-full h-9 rounded-xl text-xs font-bold border-slate-200"
                onClick={() => router.push(`/projects/${engagement.project?.id ?? engagement.project_id}?engagement_id=${engagementId}`)}
                icon={<Icons.fileText className="size-3.5" />}>
                Open Project Documents
              </Button>
            </div>
          )}

          {/* Live engagement-scoped data room (NDA / term sheet / contract) */}
          <EngagementDataRoom engagementId={engagementId} unlocked={canSeeDataRoom} />

          {/* Governance Rules */}
          <div className="p-6 rounded-2xl bg-primary text-white shadow-xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-5">
                <Icons.shieldCheck className="size-5" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/80">Platform Rules</h3>
              </div>
              <ul className="space-y-4">
                {[
                  { icon: <Shield className="size-3.5" />, text: 'Contact info is revealed only after mutual acceptance.' },
                  { icon: <FileText className="size-3.5" />, text: 'NDAs should be signed before sharing sensitive documents.' },
                  { icon: <CheckCircle className="size-3.5" />, text: 'Keep milestones updated for accurate reporting.' },
                ].map(({ icon, text }, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="size-7 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0 mt-0.5">{icon}</div>
                    <span className="text-[11px] font-medium text-white/80 leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Drop Confirmation Dialog ────────────────── */}
      <ConfirmDialog
        open={showDropConfirm}
        onClose={() => !updating && setShowDropConfirm(false)}
        onConfirm={handleDrop}
        title="Drop this engagement?"
        description="This will terminate the engagement and notify the other party. This action cannot be undone."
        confirmLabel="Drop Engagement"
        confirmVariant="danger"
        loading={updating}
      />
    </div>
  );
}
