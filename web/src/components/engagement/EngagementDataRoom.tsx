'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { engagementsApi } from '@/services/api';
import type { EngagementDocument } from '@/types';
import { Icons } from '@/components/ui/icons';
import { FileUpload } from '@/components/ui/FileUpload';
import { Lock } from 'lucide-react';
import { cn, formatUploadDate } from '@/lib/utils';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';

interface EngagementDataRoomProps {
  engagementId: string;
  /** True once the engagement is past INTRO_ACCEPTED (NDA stage+). */
  unlocked: boolean;
  /** When true, hides upload/delete controls — read-only mode for terminal engagements or MEMBER role. */
  readOnly?: boolean;
}

type DocClassification = EngagementDocument['classification'];

const DOC_TYPES: { value: EngagementDocument['document_type']; label: string }[] = [
  { value: 'NDA', label: 'NDA' },
  { value: 'TERM_SHEET', label: 'Term Sheet' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'SUPPORTING', label: 'Supporting' },
];

const CLASSIFICATIONS: { value: DocClassification; label: string; hint: string }[] = [
  { value: 'PUBLIC', label: 'Public', hint: 'Visible to all engagement parties without restriction.' },
  { value: 'RESTRICTED', label: 'Restricted', hint: 'Shared only after NDA; intended for the deal team.' },
  { value: 'CONFIDENTIAL', label: 'Confidential', hint: 'Most sensitive. Default for NDA, term sheet, contract.' },
];

const MAX_DATA_ROOM_DOCS = 5;

function fmtSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_STYLES: Record<EngagementDocument['document_type'], string> = {
  NDA: 'text-indigo-600 bg-indigo-50 border-indigo-100',
  TERM_SHEET: 'text-cyan-600 bg-cyan-50 border-cyan-100',
  CONTRACT: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  SUPPORTING: 'text-slate-600 bg-slate-50 border-slate-100',
};

const CLASS_STYLES: Record<DocClassification, string> = {
  PUBLIC: 'text-slate-500 bg-slate-50 border-slate-200',
  RESTRICTED: 'text-amber-700 bg-amber-50 border-amber-200',
  CONFIDENTIAL: 'text-red-700 bg-red-50 border-red-200',
};

/** Map a document_type to its preferred default classification. */
function defaultClassificationFor(type: EngagementDocument['document_type']): DocClassification {
  return type === 'SUPPORTING' ? 'PUBLIC' : 'CONFIDENTIAL';
}

/**
 * EngagementDataRoom — the per-engagement secure data room (PRD §E).
 *
 * Lists engagement-scoped documents (NDA, term sheet, contract, supporting),
 * lets participants upload (≤50MB, typed MIME), download via short-lived signed
 * URLs, and delete their own uploads. The list updates live via a Supabase
 * Realtime subscription on `engagement_documents`.
 */
export function EngagementDataRoom({ engagementId, unlocked, readOnly = false }: EngagementDataRoomProps) {
  const [docs, setDocs] = useState<EngagementDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [docType, setDocType] = useState<EngagementDocument['document_type']>('NDA');
  const [classification, setClassification] = useState<DocClassification>('CONFIDENTIAL');

  // When the document type changes, suggest an appropriate default classification.
  const onDocTypeChange = (next: EngagementDocument['document_type']) => {
    setDocType(next);
    setClassification(defaultClassificationFor(next));
  };

  const load = useCallback(async () => {
    const res = await engagementsApi.getDocuments(engagementId);
    if (res?.data) setDocs(res.data);
    setLoading(false);
  }, [engagementId]);

  useEffect(() => {
    if (!unlocked) { setLoading(false); return; }
    load().catch(() => setLoading(false));
  }, [unlocked, load]);

  // Live updates from the `engagement_documents` realtime publication.
  useEffect(() => {
    if (!unlocked) return;
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

    const supabase = createClient();

    // Clean stale channels.
    const cached = (supabase as any).getChannels?.() ?? [];
    const stale = cached.find((ch: any) => {
      const label = ch.topic || ch.channel || ch.name || '';
      return label.includes(`eng-docs:${engagementId}`) && ch.state !== 'closed';
    });
    if (stale) {
      try { stale.unsubscribe?.(); } catch { /* silent */ }
      supabase.removeChannel(stale).catch(() => {});
    }

    channel = supabase
      .channel(`eng-docs:${engagementId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'engagement_documents', filter: `engagement_id=eq.${engagementId}` },
        (payload) => {
          const row = payload.new as EngagementDocument;
          setDocs(prev => (prev.some(d => d.id === row.id) ? prev : [row, ...prev]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'engagement_documents', filter: `engagement_id=eq.${engagementId}` },
        (payload) => {
          const row = payload.new as any;
          if (row?.deleted_at) setDocs(prev => prev.filter(d => d.id !== row.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'engagement_documents', filter: `engagement_id=eq.${engagementId}` },
        (payload) => {
          const old = payload.old as any;
          if (old?.id) setDocs(prev => prev.filter(d => d.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      if (channel) {
        try { channel.unsubscribe?.(); } catch { /* silent */ }
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [engagementId, unlocked]);

  const handleUpload = async (files: File[]) => {
    for (const file of files) {
      const res = await engagementsApi.uploadDocument(engagementId, file, docType, classification);
      if (res?.error) toast.error(res.error);
      else toast.success(`${file.name} uploaded to the data room`);
    }
  };

  const handleDownload = async (doc: EngagementDocument) => {
    const res = await engagementsApi.downloadDocument(engagementId, doc.id);
    if (res?.error || !res?.data?.signedUrl) {
      toast.error(res?.error || 'Failed to generate download link');
      return;
    }
    window.open(res.data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (doc: EngagementDocument) => {
    const res = await engagementsApi.deleteDocument(engagementId, doc.id);
    if (res?.error) toast.error(res.error);
    else { toast.success('Document removed'); setDocs(prev => prev.filter(d => d.id !== doc.id)); }
  };

  if (!unlocked) {
    return (
      <div className="dash-card p-6">
        <h3 className="dash-section-label mb-4 flex items-center gap-2">
          <div className="size-6 bg-primary/10 rounded-none flex items-center justify-center"><Icons.fileText className="size-3 text-primary" /></div>
          Secure Data Room
        </h3>
        <div className="text-center py-4">
          <div className="size-10 bg-slate-50 rounded-none flex items-center justify-center mx-auto mb-3">
            <Lock className="size-5 text-slate-300" />
          </div>
          <p className="text-xs font-bold text-slate-700 mb-1">Locked</p>
          <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
            Document access unlocks at NDA Signed stage.
          </p>
        </div>
      </div>
    );
  }

  const remaining = MAX_DATA_ROOM_DOCS - docs.length;

  return (
    <div className="dash-card p-6">
      <h3 className="dash-section-label mb-4 flex items-center gap-2">
        <div className="size-6 bg-primary/10 rounded-none flex items-center justify-center"><Icons.fileText className="size-3 text-primary" /></div>
        Secure Data Room
        <span className="ml-auto text-[10px] font-bold text-slate-400">{docs.length}/{MAX_DATA_ROOM_DOCS}</span>
      </h3>

      {!readOnly && (
        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
          Upload the NDA, term sheet, and contract drafts. Files are visible only to the two engagement parties. Tag each
          document's classification — <span className="font-bold text-red-600">Confidential</span> for the deal core,
          <span className="font-bold text-amber-700"> Restricted</span> for deal-team-only material,
          <span className="font-bold text-slate-600"> Public</span> for anything shareable without an NDA.
        </p>
      )}

      {/* Upload controls — hidden in read-only mode */}
      {!readOnly && (
        <>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Type</span>
              <select
                value={docType}
                onChange={e => onDocTypeChange(e.target.value as EngagementDocument['document_type'])}
                className="text-[11px] font-bold rounded-none border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Classification</span>
              <select
                value={classification}
                onChange={e => setClassification(e.target.value as DocClassification)}
                title={CLASSIFICATIONS.find(c => c.value === classification)?.hint}
                className="text-[11px] font-bold rounded-none border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {CLASSIFICATIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
          </div>

          <FileUpload
            onUpload={handleUpload}
            maxFiles={MAX_DATA_ROOM_DOCS}
            multiple
            existingCount={docs.length}
            className="mb-4"
            label="Drag documents here or click to browse"
          />
        </>
      )}

      {/* Read-only banner */}
      {readOnly && (
        <div className="p-3 mb-4 rounded-none bg-slate-50 border border-slate-100 flex items-center gap-2">
          <Icons.lock className="size-3.5 text-slate-400" />
          <p className="text-[11px] font-medium text-slate-500">Read-only mode. This engagement is in a terminal state.</p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-6 text-center"><Icons.spinner className="size-5 animate-spin mx-auto text-slate-300" /></div>
      ) : docs.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-slate-400 font-medium">
          No documents yet. Upload the NDA to begin.
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-3 p-2.5 rounded-none border border-slate-100 bg-white hover:bg-slate-50 transition group">
              <span className={cn('inline-flex items-center justify-center size-7 rounded-none text-[8px] font-black shrink-0 border', TYPE_STYLES[d.document_type])}>
                {d.document_type === 'NDA' ? 'NDA' : d.document_type === 'TERM_SHEET' ? 'TS' : d.document_type === 'CONTRACT' ? 'CT' : 'DOC'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  {d.classification !== 'PUBLIC' && (
                    <Lock className="size-3 shrink-0 text-slate-400" aria-label={`${d.classification.toLowerCase()} access`} />
                  )}
                  <p className="text-xs font-semibold text-slate-800 truncate">{d.file_name}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={cn('inline-flex items-center rounded px-1 py-px text-[8px] font-black uppercase tracking-wide border', CLASS_STYLES[d.classification])}>
                    {d.classification}
                  </span>
                  <p className="text-[10px] text-slate-400 font-medium truncate">
                    {d.document_type.replace('_', ' ')} · {fmtSize(d.size_bytes)} · {formatUploadDate(d.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(d)}
                aria-label="Download"
                className="opacity-0 group-hover:opacity-100 transition size-7 rounded-none hover:bg-primary/10 text-slate-400 hover:text-primary flex items-center justify-center shrink-0"
              >
                <Icons.download className="size-3.5" />
              </button>
              {/* Delete button — hidden in read-only mode */}
              {!readOnly && (
                <button
                  onClick={() => handleDelete(d)}
                  aria-label="Delete"
                  className="opacity-0 group-hover:opacity-100 transition size-7 rounded-none hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center shrink-0"
                >
                  <Icons.trash className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
