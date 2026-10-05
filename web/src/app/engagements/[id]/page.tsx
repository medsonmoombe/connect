'use client';


import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Engagement } from '@/types';
import {
  engagementService,
  getStateLabel,
  getTransitionsForRole,
  getStateProgress,
  type TransitionRole,
} from '@/lib/engagement';
import { getCounterpartyLabel, withIndefiniteArticle } from '@/lib/role-labels';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { EngagementMilestones } from '@/components/EngagementMilestones';
import type { EngagementStateEntry } from '@/components/EngagementMilestones';
import { EngagementDataRoom } from '@/components/engagement/EngagementDataRoom';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, Send, Shield, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { messagesApi } from '@/services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  engagement_id: string;
  sender_id: string;
  message_body: string;
  created_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  INTRO_SENT:        { label: 'Introduction Sent',     color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-100' },
  INTRO_ACCEPTED:    { label: 'Introduction Accepted', color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100' },
  NDA_SIGNED:        { label: 'NDA Signed',            color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
  DUE_DILIGENCE:     { label: 'Due Diligence',         color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-100' },
  TERM_SHEET:        { label: 'Term Sheet',            color: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-cyan-100' },
  CONTRACT_SIGNED:   { label: 'Contract Signed',       color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CAPITAL_COMMITTED: { label: 'Capital Committed',     color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  CLOSED:            { label: 'Closed',                color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  DROPPED:           { label: 'Dropped',               color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100' },
};

/** Users may delete their own messages within this window. */
const SELF_DELETE_WINDOW_MS = 5 * 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-64" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-44" />
          <Skeleton className="h-[480px]" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-52" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Error / not-found state
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="py-24 text-center">
      <div className="size-16 bg-slate-50 rounded-none flex items-center justify-center mx-auto mb-6 border border-slate-100">
        <Icons.messageSquare className="size-8 text-slate-300" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Engagement Not Found</h2>
      <p className="text-sm text-slate-500 mb-8 max-w-xs mx-auto">{message}</p>
      <Button onClick={onBack} className="h-10 px-6 rounded-none">
        Back to Dashboard
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card — project name, status, milestones, progress
// ─────────────────────────────────────────────────────────────────────────────

function HeroCard({
  engagement,
  stateHistory,
}: {
  engagement: Engagement;
  stateHistory: EngagementStateEntry[];
}) {
  const st       = STATUS_CONFIG[engagement.status] ?? STATUS_CONFIG.INTRO_SENT;
  const progress = getStateProgress(engagement.status);
  const isTerminal = engagement.status === 'DROPPED' || engagement.status === 'CLOSED';

  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      {/* Dark header */}
      <div className="bg-[#0b3b24] px-8 py-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-none text-[9px] font-bold tracking-widest border mb-3', st.bg, st.color, st.border)}>
            <span className="size-1.5 rounded-full bg-current" />
            {st.label}
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight mb-3">
            {engagement.project?.name || 'Untitled Project'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">
              {getCounterpartyLabel(engagement.counterparty_type)}
            </span>
            <span className="text-emerald-200/30">·</span>
            <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">
              ID: {engagement.id.substring(0, 8)}
            </span>
            <span className="text-emerald-200/30">·</span>
            <span className="text-[10px] font-bold text-emerald-200/70 tracking-wider">
              {new Date(engagement.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
        {/* Progress panel */}
        <div className="shrink-0 w-36">
          <div className="p-4 bg-white/10 border border-white/10 text-center">
            <p className="text-[9px] font-bold text-emerald-200/60 tracking-widest mb-2">PROGRESS</p>
            <p className="text-4xl font-black text-white leading-none">{progress}<span className="text-lg">%</span></p>
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', isTerminal ? 'bg-red-400' : 'bg-emerald-400')}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Milestone timeline */}
      <div className="px-8 py-5 border-b border-slate-100">
        <EngagementMilestones currentStatus={engagement.status} history={stateHistory} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Action panel — strategic deal controls
// ─────────────────────────────────────────────────────────────────────────────

function IntroRequestPanel({
  engagement, introOrigin, isDeveloper, loadingAction, onAccept, onDecline,
}: {
  engagement: Engagement; introOrigin: 'developer' | 'partner'; isDeveloper: boolean;
  loadingAction: string | null; onAccept: () => void; onDecline: () => void;
}) {
  const counterpartyLabel = getCounterpartyLabel(engagement.counterparty_type);
  const counterpartyName = (engagement as any).counterparty_company?.name ?? 'the partner';
  const developerName = (engagement.project as any)?.developer?.name ?? 'The developer';
  const projectName = engagement.project?.name ?? 'the project';

  // The copy depends on WHO initiated the request, not just on the
  // counterparty type: the party that did NOT send the request is the one
  // that accepts it (see intro_origin / migration 073).
  let title: string;
  let body: React.ReactNode;
  let showAccept = false;

  if (introOrigin === 'developer') {
    if (isDeveloper) {
      // The developer sent this request — they wait (and may withdraw it).
      title = 'Introduction Request Sent';
      body = (
        <>
          You requested an introduction to <b className="font-semibold text-white">{counterpartyName}</b>{' '}
          ({counterpartyLabel}) on “{projectName}”. They have been notified and can accept or decline —
          you’ll be notified as soon as they respond.
        </>
      );
    } else {
      // The counterparty received the request — they accept or decline.
      title = 'New Introduction Request';
      showAccept = true;
      body = (
        <>
          <b className="font-semibold text-white">{developerName}</b> has requested an introduction on
          “{projectName}”. Accept to reveal their contact details and begin the NDA process.
        </>
      );
    }
  } else if (isDeveloper) {
    // Partner expressed interest (partner-initiated): the developer accepts.
    title = 'New Introduction Request';
    showAccept = true;
    body = (
      <>
        {withIndefiniteArticle(counterpartyLabel)}{' '}has expressed interest in your project. Accept to
        reveal their contact details and begin the NDA process.
      </>
    );
  } else {
    return null; // handled by the AwaitingPanel below
  }

  return (
    <div className="bg-[#0b3b24] text-white p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 pointer-events-none" />
      <div className="relative">
        <p className="text-[10px] font-black text-emerald-200/60 tracking-widest uppercase mb-2">{title}</p>
        <p className="text-sm font-medium text-white/90 mb-5 leading-relaxed max-w-lg">{body}</p>
        <div className="flex flex-wrap gap-3">
          {showAccept && (
            <Button
              onClick={onAccept}
              disabled={loadingAction !== null}
              className="h-9 px-6 bg-white text-green-900 font-bold text-xs hover:bg-white/90"
              icon={loadingAction === 'INTRO_ACCEPTED' ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.check className="size-3.5" />}
            >
              Accept Introduction
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onDecline}
            disabled={loadingAction !== null}
            className="h-9 px-6 font-bold text-xs border-white/20 text-slate-300 hover:bg-white/5"
          >
            {showAccept ? 'Decline' : 'Withdraw Request'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function AwaitingPanel({ message }: { message: string }) {
  return (
    <div className="p-5 bg-amber-50 border border-amber-100 flex items-start gap-4">
      <div className="size-9 rounded-none bg-amber-100 flex items-center justify-center shrink-0">
        <Icons.clock className="size-4 text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-bold text-amber-900 mb-1">Awaiting Response</p>
        <p className="text-xs text-amber-700 font-medium leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

function AdvancePanel({
  nextStates, loadingAction, transitionHint, onAdvance, onDrop,
}: {
  nextStates: string[]; loadingAction: string | null; transitionHint: string | null;
  onAdvance: (state: string) => void; onDrop: () => void;
}) {
  return (
    <div className="p-6 space-y-4">
      <p className="text-xs text-slate-500 font-medium">Advance the deal milestone as you progress through the workflow.</p>
      {transitionHint && (
        <div className="p-4 bg-amber-50 border border-amber-100 flex items-start gap-3">
          <Shield className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] font-medium text-amber-800 leading-relaxed">{transitionHint}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {nextStates.map(state => (
          <Button
            key={state}
            onClick={() => state === 'DROPPED' ? onDrop() : onAdvance(state)}
            disabled={loadingAction !== null}
            variant={state === 'DROPPED' ? 'outline' : 'default'}
            className={cn('h-9 px-5 font-bold text-xs', state === 'DROPPED' && 'border-red-200 text-red-600 hover:bg-red-50')}
            icon={loadingAction === state ? <Icons.spinner className="size-3.5 animate-spin" /> : undefined}
          >
            {state === 'DROPPED' ? 'Drop Engagement' : `Move to ${getStateLabel(state as any)}`}
          </Button>
        ))}
      </div>
    </div>
  );
}

function WaitingPanel({ isDeveloper }: { isDeveloper: boolean }) {
  return (
    <div className="p-5 bg-amber-50 border border-amber-100 flex items-start gap-4">
      <div className="size-9 rounded-none bg-amber-100 flex items-center justify-center shrink-0">
        <Icons.clock className="size-4 text-amber-600" />
      </div>
      <div>
        <p className="text-sm font-bold text-amber-900 mb-1">Awaiting Other Party</p>
        <p className="text-xs text-amber-700 font-medium leading-relaxed">
          This milestone is waiting for the {isDeveloper ? 'partner' : 'developer'} to take action. You’ll be notified once they respond.
        </p>
      </div>
    </div>
  );
}

function ActionPanel({
  engagement, introOrigin, isDeveloper, nextStates, loadingAction, transitionHint,
  onAdvance, onAcceptIntro, onDropRequest,
}: {
  engagement: Engagement; introOrigin: 'developer' | 'partner'; isDeveloper: boolean; nextStates: string[];
  loadingAction: string | null; transitionHint: string | null;
  onAdvance: (state: string) => void; onAcceptIntro: () => void; onDropRequest: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="bg-[#0b3b24] px-6 py-3 flex items-center gap-2">
        <Icons.zap className="size-3.5 text-emerald-200" />
        <p className="text-[10px] font-bold text-white uppercase tracking-widest">Strategic Actions</p>
      </div>
      {engagement.status === 'INTRO_SENT' && (
        <>
          <IntroRequestPanel
            engagement={engagement}
            introOrigin={introOrigin}
            isDeveloper={isDeveloper}
            loadingAction={loadingAction}
            onAccept={onAcceptIntro}
            onDecline={onDropRequest}
          />
          {/* Partner expressed interest (legacy/partner-initiated): the partner waits on the developer. */}
          {introOrigin !== 'developer' && !isDeveloper && (
            <div className="p-6"><AwaitingPanel message="The developer has been notified. You’ll receive an email and in-app notification once they respond." /></div>
          )}
        </>
      )}
      {engagement.status !== 'INTRO_SENT' && nextStates.length > 0 && (
        <AdvancePanel nextStates={nextStates} loadingAction={loadingAction} transitionHint={transitionHint} onAdvance={onAdvance} onDrop={onDropRequest} />
      )}
      {engagement.status !== 'INTRO_SENT' && nextStates.length === 0 && (
        <div className="p-6"><WaitingPanel isDeveloper={isDeveloper} /></div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal states (CLOSED / DROPPED)
// ─────────────────────────────────────────────────────────────────────────────

function TerminalState({ status }: { status: string }) {
  if (status === 'CLOSED') {
    return (
      <div className="border border-emerald-100 bg-emerald-50 p-10 flex flex-col items-center text-center">
        <div className="size-14 bg-white flex items-center justify-center text-emerald-500 mb-4 border border-emerald-100">
          <CheckCircle className="size-7" />
        </div>
        <h3 className="text-lg font-bold text-emerald-900 mb-1">Deal Closed</h3>
        <p className="text-emerald-700 font-medium text-sm">This engagement has successfully reached Financial Close.</p>
      </div>
    );
  }
  return (
    <div className="p-10 text-center border border-dashed border-slate-200 bg-white">
      <div className="size-12 bg-slate-50 flex items-center justify-center mx-auto mb-3 border border-slate-100">
        <XCircle className="size-6 text-slate-300" />
      </div>
      <p className="text-xs font-bold text-slate-400 tracking-widest uppercase">Engagement Terminated</p>
    </div>
  );
}

function ReadOnlyBanner() {
  return (
    <div className="p-5 bg-slate-50 border border-slate-200 flex items-start gap-3">
      <div className="size-8 bg-slate-100 flex items-center justify-center shrink-0">
        <Icons.lock className="size-3.5 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-600 mb-0.5">Read-Only Access</p>
        <p className="text-xs text-slate-400 font-medium leading-relaxed">As a team member, you can view engagement activity but cannot perform actions or send messages.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  canDelete,
  onDelete,
}: {
  message: Message;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const senderName = message.sender?.full_name ?? (isOwn ? 'You' : 'Partner');
  const initials   = getInitials(senderName);

  return (
    <div className={cn('group flex gap-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'size-8 rounded-none flex items-center justify-center text-[10px] font-black shrink-0 mt-1',
          isOwn ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
        )}
      >
        {initials}
      </div>

      {/* Bubble */}
      <div className={cn('max-w-[72%] space-y-1', isOwn && 'items-end flex flex-col')}>
        <div className="relative">
          <div
            className={cn(
              'px-4 py-3 rounded-none text-sm font-medium leading-relaxed',
              isOwn
                ? 'bg-primary text-white rounded-tr-sm'
                : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-sm'
            )}
          >
            {message.message_body}
          </div>

          {/* Delete button (within 5-min window) */}
          {canDelete && (
            <button
              type="button"
              aria-label="Delete message"
              onClick={onDelete}
              className={cn(
                'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity',
                'size-6 rounded-full bg-white hover:bg-red-50 border border-slate-200 shadow-sm',
                'flex items-center justify-center text-slate-400 hover:text-red-500',
                isOwn ? '-left-8' : '-right-8'
              )}
            >
              <Icons.trash className="size-3" />
            </button>
          )}
        </div>

        <p
          className={cn(
            'text-[9px] font-bold text-slate-400 tracking-widest px-1',
            isOwn ? 'text-right' : 'text-left'
          )}
        >
          {senderName} · {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message input
// ─────────────────────────────────────────────────────────────────────────────

function MessageInput({
  value,
  sending,
  inputRef,
  onChange,
  onSend,
  onKeyDown,
}: {
  value: string;
  sending: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div className="p-4 border-t border-slate-100 bg-slate-50/50">
      <div className="flex gap-3 items-end">
        <textarea
          ref={inputRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none rounded-none border border-slate-200 bg-white px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          style={{ maxHeight: '120px' }}
        />
        <Button
          onClick={onSend}
          disabled={!value.trim() || sending}
          className="size-11 rounded-none bg-primary text-white p-0 shrink-0 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"
          aria-label="Send message"
        >
          {sending
            ? <Icons.spinner className="size-4 animate-spin" />
            : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Message thread — live messaging panel
// ─────────────────────────────────────────────────────────────────────────────

function MessageThread({
  messages,
  newMessage,
  sending,
  realtimeStatus,
  canMessage,
  userId,
  inputRef,
  messagesEndRef,
  onMessageChange,
  onSend,
  onKeyDown,
  onDeleteMessage,
  canDeleteMessage,
}: {
  messages: Message[];
  newMessage: string;
  sending: boolean;
  realtimeStatus: 'connecting' | 'connected' | 'disconnected';
  canMessage: boolean;
  userId: string;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onMessageChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDeleteMessage: (id: string) => void;
  canDeleteMessage: (msg: Message) => boolean;
}) {
  const statusDot = {
    connected:    'bg-green-500 animate-pulse',
    connecting:   'bg-amber-400 animate-pulse',
    disconnected: 'bg-red-400',
  }[realtimeStatus];

  return (
    <div
      className="rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)] overflow-hidden flex flex-col"
      style={{ minHeight: '520px' }}
    >
      {/* Header */}
      <div className="bg-[#0b3b24] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', statusDot)} />
          <p className="text-[10px] font-bold text-white tracking-widest uppercase">Live Messaging</p>
        </div>
        <p className="text-[10px] text-emerald-200/60 font-medium">
          {realtimeStatus} · {messages.length} messages
        </p>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        style={{ maxHeight: '380px' }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <div className="size-14 bg-slate-50 rounded-none flex items-center justify-center mb-4 border border-slate-100">
              <Icons.messageSquare className="size-6 text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-1">
              No messages yet
            </p>
            <p className="text-[11px] text-slate-400">
              {canMessage ? 'Start the conversation below.' : 'Messages will appear here once available.'}
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === userId}
              canDelete={canDeleteMessage(msg)}
              onDelete={() => onDeleteMessage(msg.id)}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {canMessage && (
        <MessageInput
          value={newMessage}
          sending={sending}
          inputRef={inputRef}
          onChange={onMessageChange}
          onSend={onSend}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Counterparty card (sidebar)
// ─────────────────────────────────────────────────────────────────────────────

function CounterpartyCard({
  engagement, isDeveloper,
}: {
  engagement: Engagement; isDeveloper: boolean;
}) {
  const company = (engagement as any).counterparty_company;
  const label   = isDeveloper ? getCounterpartyLabel(engagement.counterparty_type) : 'Project Developer';
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <p className="text-[10px] font-bold text-white uppercase tracking-widest">{label}</p>
      </div>
      <div className="p-5">
        {company ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-none bg-green-50 border border-green-100 flex items-center justify-center text-green-800 font-bold text-sm shrink-0">
                {getInitials(company.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{company.name}</p>
                <p className="text-[10px] text-slate-400 tracking-widest font-bold uppercase mt-0.5">
                  {getCounterpartyLabel(engagement.counterparty_type)}
                </p>
              </div>
            </div>
            {company.website && (
              <div className="flex items-center justify-between text-[10px] font-bold bg-slate-50 border border-slate-100 px-4 py-3">
                <span className="text-slate-400 tracking-widest">Website</span>
                <a href={company.website} target="_blank" rel="noopener noreferrer"
                  className="text-green-800 hover:underline truncate max-w-[140px]">
                  {company.website.replace(/^https?:\/\//, '').substring(0, 28)}
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center border border-dashed border-slate-200">
            <Icons.lock className="size-4 mx-auto text-slate-300 mb-2" />
            <p className="text-[10px] font-bold text-slate-400 tracking-widest">
              {engagement.status === 'INTRO_SENT' ? 'Contact details revealed after acceptance' : 'Loading counterparty info…'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const GOVERNANCE_RULES = [
  { icon: <Shield className="size-3.5" />, text: 'Contact info is revealed only after mutual acceptance.' },
  { icon: <FileText className="size-3.5" />, text: 'NDAs should be signed before sharing sensitive documents.' },
  { icon: <CheckCircle className="size-3.5" />, text: 'Keep milestones updated for accurate deal reporting.' },
];

function GovernanceCard() {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <Icons.shieldCheck className="size-3.5 text-emerald-200" />
        <p className="text-[10px] font-bold text-white uppercase tracking-widest">Platform Rules</p>
      </div>
      <ul className="divide-y divide-slate-50">
        {GOVERNANCE_RULES.map(({ icon, text }, i) => (
          <li key={i} className="flex items-start gap-3 px-5 py-4">
            <div className="size-7 rounded-none bg-green-50 border border-green-100 flex items-center justify-center text-green-800 shrink-0 mt-0.5">
              {icon}
            </div>
            <p className="text-[11px] font-medium text-slate-600 leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataRoomSection({
  engagementId, projectId, isReadOnly, onOpenProjectDocs,
}: {
  engagementId: string; projectId: string; isReadOnly: boolean; onOpenProjectDocs: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="bg-[#0b3b24] px-6 py-3 flex items-center gap-2">
        <Icons.fileText className="size-3.5 text-emerald-200" />
        <p className="text-[10px] font-bold text-white uppercase tracking-widest">Secure Data Room</p>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-xs text-slate-500 font-medium leading-relaxed">
          Browse and manage documents shared for this engagement. All access is logged for audit.
        </p>
        <Button
          variant="outline"
          className="w-full h-9 text-xs font-bold border-slate-200"
          onClick={onOpenProjectDocs}
          icon={<Icons.fileText className="size-3.5" />}
        >
          Open Project Documents
        </Button>
        <EngagementDataRoom engagementId={engagementId} unlocked readOnly={isReadOnly} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — data orchestration
// ─────────────────────────────────────────────────────────────────────────────

export default function EngagementRoomPage() {
  const params       = useParams();
  const router       = useRouter();
  const { user }     = useAuth();
  const engagementId = params.id as string;

  // ── State ────────────────────────────────────────────────────────────────
  const [engagement,    setEngagement]    = useState<Engagement | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [newMessage,    setNewMessage]    = useState('');
  const [stateHistory,  setStateHistory]  = useState<EngagementStateEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [showDropConfirm, setShowDropConfirm] = useState(false);
  const [realtimeStatus, setRealtimeStatus]   = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const resolveSender = useCallback(async (senderId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name, avatar_url')
        .eq('id', senderId)
        .maybeSingle();
      if (data?.full_name) {
        setMessages(prev =>
          prev.map(m =>
            m.sender_id === senderId && !m.sender
              ? { ...m, sender: { id: senderId, full_name: data.full_name, avatar_url: data.avatar_url } }
              : m
          )
        );
      }
    } catch {
      // Non-critical — sender name gracefully degrades to 'Partner'
    }
  }, []);

  const loadStateHistory = useCallback(async () => {
    if (!engagementId) return;
    try {
      const res = await apiClient.get<{ data: { states: EngagementStateEntry[] } }>(
        `/engagements/${engagementId}/audit`
      );
      setStateHistory(res?.data?.states ?? []);
    } catch {
      // Non-fatal — milestones degrade to live status only
    }
  }, [engagementId]);

  // ── Initial data ──────────────────────────────────────────────────────────
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

  useEffect(() => { loadStateHistory(); }, [loadStateHistory]);

  // ── Messages ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!engagementId) return;
    let cancelled = false;

    async function loadMessages() {
      try {
        const res = await apiClient.get<{ data: Message[] }>(
          `/messages?engagement_id=${engagementId}`
        );
        if (!cancelled) setMessages(res.data ?? []);
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes('Could not find a relationship') || msg.includes('schema cache')) {
          // FK embed unavailable — fall back to base columns only
          try {
            const fallback = await apiClient.get<{ data: any[] }>(
              `/messages?engagement_id=${engagementId}&_no_sender=1`
            );
            if (!cancelled) setMessages((fallback.data ?? []).map((m: any) => ({ ...m, sender: undefined })));
          } catch {
            if (!cancelled) setMessages([]);
          }
        } else {
          if (!cancelled) setMessages([]);
        }
      }
    }

    loadMessages();
    messagesApi.markRead(engagementId).catch(() => {});
    return () => { cancelled = true; };
  }, [engagementId]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  // ── Realtime subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    if (!engagementId) return;
    const supabase = createClient();
    setRealtimeStatus('connecting');

    const materialize = (row: any): Message => ({
      id:             row.id,
      engagement_id:  row.engagement_id ?? engagementId,
      sender_id:      row.sender_id,
      message_body:   row.message_body ?? '',
      created_at:     row.created_at ?? new Date().toISOString(),
      deleted_at:     row.deleted_at ?? null,
      deleted_by:     row.deleted_by ?? null,
      sender: row.sender_id === user?.id
        ? { id: user?.id ?? '', full_name: user?.full_name ?? null, avatar_url: user?.avatar_url ?? null }
        : undefined,
    });

    const messageChannel = supabase
      .channel(`messages:${engagementId}`, { config: { broadcast: { self: false } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `engagement_id=eq.${engagementId}` }, (payload) => {
        const msg = materialize(payload.new as any);
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          if (msg.sender_id === user?.id) {
            const optIdx = prev.findIndex(m => m.id.startsWith('optimistic-'));
            if (optIdx !== -1) {
              const copy = [...prev];
              copy[optIdx] = msg;
              return copy;
            }
          }
          if (msg.sender_id !== user?.id) resolveSender(msg.sender_id).catch(() => {});
          return [...prev, msg];
        });
        if (msg.sender_id !== user?.id) {
          messagesApi.markRead(engagementId).catch(() => {});
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `engagement_id=eq.${engagementId}` }, (payload) => {
        const row = payload.new as any;
        if (row?.deleted_at) {
          setMessages(prev => prev.filter(m => m.id !== row.id));
          return;
        }
        setMessages(prev => prev.map(m => m.id === row.id ? { ...m, ...materialize(row) } : m));
        if (row?.sender_id && row.sender_id !== user?.id) resolveSender(row.sender_id).catch(() => {});
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `engagement_id=eq.${engagementId}` }, (payload) => {
        const old = payload.old as any;
        if (old?.id) setMessages(prev => prev.filter(m => m.id !== old.id));
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED')  setRealtimeStatus('connected');
        if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setRealtimeStatus('disconnected');
      });

    const engChannel = supabase
      .channel(`engagement:${engagementId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'engagements', filter: `id=eq.${engagementId}` }, (payload) => {
        const updated = payload.new as any;
        setEngagement(prev => prev ? { ...prev, status: updated?.status ?? prev.status } as any : prev);
      })
      .subscribe();

    return () => {
      setRealtimeStatus('disconnected');
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(engChannel);
    };
  }, [engagementId, user?.id, user?.full_name, user?.avatar_url]);

  // ── Message actions ───────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = newMessage.trim();
    if (!content || sending) return;

    setSending(true);
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id:             optimisticId,
      engagement_id:  engagementId,
      sender_id:      user?.id ?? '',
      message_body:   content,
      created_at:     new Date().toISOString(),
      sender: { id: user?.id ?? '', full_name: user?.full_name ?? null, avatar_url: user?.avatar_url ?? null },
    };

    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');

    try {
      const res = await apiClient.post<{ data: Message }>('/messages', {
        engagement_id: engagementId,
        content,
      });
      setMessages(prev => prev.map(m => m.id === optimisticId ? res.data : m));
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setNewMessage(content);
      toast.error(err?.message || 'Failed to send message.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canDeleteMessage = useCallback(
    (msg: Message) =>
      msg.sender_id === user?.id &&
      !msg.deleted_at &&
      !msg.id.startsWith('optimistic-') &&
      Date.now() - new Date(msg.created_at).getTime() <= SELF_DELETE_WINDOW_MS,
    [user?.id]
  );

  const handleDeleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    try {
      await messagesApi.remove(msgId);
      toast.success('Message deleted.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not delete message.');
      const res = await apiClient.get<{ data: Message[] }>(`/messages?engagement_id=${engagementId}`);
      setMessages(res.data ?? []);
    }
  };

  // ── Status actions ────────────────────────────────────────────────────────
  const handleStatusUpdate = async (nextStatus: any) => {
    if (!engagement) return;
    setLoadingAction(nextStatus);
    try {
      await engagementService.updateStatus(engagement.id, nextStatus);
      const updated = await engagementService.getEngagement(engagement.id);
      setEngagement(updated);
      loadStateHistory();
      toast.success(`Engagement moved to ${getStateLabel(nextStatus)}`);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update engagement status.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDrop = async () => {
    setShowDropConfirm(false);
    if (!engagement) return;
    setLoadingAction('DROPPED');
    try {
      await engagementService.updateStatus(engagement.id, 'DROPPED');
      const updated = await engagementService.getEngagement(engagement.id);
      setEngagement(updated);
      loadStateHistory();
      toast.success('Engagement dropped.');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to drop engagement.');
    } finally {
      setLoadingAction(null);
    }
  };

  // ── Render gates ──────────────────────────────────────────────────────────
  if (loading) return <div className="max-w-6xl mx-auto py-8 px-4"><PageSkeleton /></div>;

  if (error || !engagement) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <ErrorState
          message={error ?? "This engagement doesn't exist or you don't have access."}
          onBack={() => router.back()}
        />
      </div>
    );
  }

  // ── Role resolution ───────────────────────────────────────────────────────
  const isDeveloper          = user?.company_id === (engagement.project as any)?.developer_id;
  const isAdmin              = user?.role === 'ADMIN';
  const counterpartyCompanyId = (engagement as any).counterparty_company_id as string | undefined;
  const isCounterparty       = !isDeveloper && !!counterpartyCompanyId && user?.company_id === counterpartyCompanyId;
  // Direction of the intro request.
  // NULL on legacy rows: infer from role — if the current user is the developer
  // they almost certainly initiated it via the "Contact" button on the submit
  // form, so default to 'developer'. Only fall back to 'partner' for counterparty viewers.
  const introOrigin: 'developer' | 'partner' = (
    (engagement as any).intro_origin as 'developer' | 'partner' | null
  ) ?? (isDeveloper ? 'developer' : 'partner');
  const userRole: TransitionRole | null = isDeveloper ? 'developer' : isCounterparty ? 'counterparty' : null;
  const nextStates           = getTransitionsForRole(engagement.status, userRole, introOrigin);
  const isTerminal           = engagement.status === 'DROPPED' || engagement.status === 'CLOSED';
  const isMemberRole         = (user as any)?.org_member_role === 'MEMBER';
  const isReadOnly           = isTerminal || isMemberRole;
  const canMessage           = !isTerminal && !isMemberRole && engagement.status !== 'INTRO_SENT';
  const canSeeDataRoom       = !['INTRO_SENT', 'INTRO_ACCEPTED'].includes(engagement.status);

  // Transition hint copy
  const transitionHint = (() => {
    if (isAdmin) return null;
    switch (engagement.status) {
      case 'INTRO_ACCEPTED':
        return nextStates.includes('NDA_SIGNED')
          ? 'Sign the NDA (offline for MVP) and advance to record it. Upload the NDA to the data room for an audit trail.'
          : null;
      case 'DUE_DILIGENCE':
        return nextStates.includes('TERM_SHEET')
          ? 'The counterparty must review the shared data-room documents before a term sheet can be issued.'
          : null;
      case 'TERM_SHEET':
        return nextStates.includes('CONTRACT_SIGNED')
          ? 'Upload a signed term sheet or contract draft to the engagement data room to advance to Contract Signed.'
          : null;
      default:
        return null;
    }
  })();

  const projectId = engagement.project?.id ?? (engagement as any).project_id ?? '';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">

      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors tracking-widest uppercase"
      >
        <Icons.arrowLeft className="size-3.5" />
        Back
      </button>

      {/* Hero */}
      <HeroCard engagement={engagement} stateHistory={stateHistory} />

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── Primary column ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Action panel — only for active, non-read-only roles */}
          {!isReadOnly && (
            <ActionPanel
              engagement={engagement}
              introOrigin={introOrigin}
              isDeveloper={isDeveloper}
              nextStates={nextStates}
              loadingAction={loadingAction}
              transitionHint={transitionHint}
              onAdvance={handleStatusUpdate}
              onAcceptIntro={() => handleStatusUpdate('INTRO_ACCEPTED')}
              onDropRequest={() => setShowDropConfirm(true)}
            />
          )}

          {/* Read-only banner */}
          {!isTerminal && isMemberRole && <ReadOnlyBanner />}

          {/* Terminal states */}
          {isTerminal && <TerminalState status={engagement.status} />}

          {/* Messaging */}
          <MessageThread
            messages={messages}
            newMessage={newMessage}
            sending={sending}
            realtimeStatus={realtimeStatus}
            canMessage={canMessage}
            userId={user?.id ?? ''}
            inputRef={inputRef}
            messagesEndRef={messagesEndRef}
            onMessageChange={setNewMessage}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            onDeleteMessage={handleDeleteMessage}
            canDeleteMessage={canDeleteMessage}
          />

          {/* Data room */}
          {canSeeDataRoom && (
            <DataRoomSection
              engagementId={engagementId}
              projectId={projectId}
              isReadOnly={isReadOnly}
              onOpenProjectDocs={() =>
                router.push(`/projects/${projectId}?engagement_id=${engagementId}`)
              }
            />
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-5">
          <CounterpartyCard engagement={engagement} isDeveloper={isDeveloper} />
          <GovernanceCard />
        </div>
      </div>

      {/* Drop confirmation */}
      <ConfirmDialog
        open={showDropConfirm}
        onClose={() => !loadingAction && setShowDropConfirm(false)}
        onConfirm={handleDrop}
        title="Drop this engagement?"
        description="This will terminate the engagement and notify the other party. This action cannot be undone."
        confirmLabel="Drop Engagement"
        confirmVariant="danger"
        loading={loadingAction === 'DROPPED'}
      />
    </div>
  );
}