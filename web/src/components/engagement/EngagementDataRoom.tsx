'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { engagementsApi } from '@/services/api';
import type { EngagementDocument } from '@/types';
import { Icons } from '@/components/ui/icons';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface EngagementDataRoomProps {
  engagementId: string;
  /** True once the engagement is past INTRO_ACCEPTED (NDA stage+). */
  unlocked: boolean;
}

const DOC_TYPES: { value: EngagementDocument['document_type']; label: string }[] = [
  { value: 'NDA', label: 'NDA' },
  { value: 'TERM_SHEET', label: 'Term Sheet' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'SUPPORTING', label: 'Supporting' },
];

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

/**
 * EngagementDataRoom — the per-engagement secure data room (PRD §E).
 *
 * Lists engagement-scoped documents (NDA, term sheet, contract, supporting),
 * lets participants upload (≤50MB, typed MIME), download via short-lived signed
 * URLs, and delete their own uploads. The list updates live via a Supabase
 * Realtime subscription on `engagement_documents` (published in migration 041).
 */
export function EngagementDataRoom({ engagementId, unlocked }: EngagementDataRoomProps) {
  const [docs, setDocs] = useState<EngagementDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<EngagementDocument['document_type']>('NDA');
  const fileRef = useRef<HTMLInputElement>(null);

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
    let channel: any = null;
    (async () => {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();
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
    })();
    return () => { if (channel) { try { (async () => { const { createClient } = await import('@/lib/supabase'); createClient().removeChannel(channel); })(); } catch {} } };
  }, [engagementId, unlocked]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await engagementsApi.uploadDocument(engagementId, file, docType, 'CONFIDENTIAL');
      if (res?.error) toast.error(res.error);
      else toast.success(`${file.name} uploaded to the data room`);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: EngagementDocument) => {
    const res = await engagementsApi.downloadDocument(engagementId, doc.id);
    if (res?.error || !res?.data?.signedUrl) {
      toast.error(res?.error || 'Failed to generate download link');
      return;
    }
    // Open the short-lived signed URL in a new tab.
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
          <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.fileText className="size-3 text-primary" /></div>
          Secure Data Room
        </h3>
        <div className="text-center py-4">
          <div className="size-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
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

  return (
    <div className="dash-card p-6">
      <h3 className="dash-section-label mb-4 flex items-center gap-2">
        <div className="size-6 bg-primary/10 rounded-lg flex items-center justify-center"><Icons.fileText className="size-3 text-primary" /></div>
        Secure Data Room
      </h3>

      <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
        Upload the NDA, term sheet, and contract drafts. Files are visible only to the two engagement parties.
      </p>

      {/* Upload row */}
      <div className="flex gap-2 mb-4">
        <select
          value={docType}
          onChange={e => setDocType(e.target.value as EngagementDocument['document_type'])}
          className="text-[11px] font-bold rounded-lg border border-slate-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {uploading ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.paperclip className="size-3.5" />}
          {uploading ? 'Uploading…' : 'Upload Document'}
        </button>
      </div>

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
            <li key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition group">
              <span className={cn('inline-flex items-center justify-center size-7 rounded-lg text-[8px] font-black shrink-0 border', TYPE_STYLES[d.document_type])}>
                {d.document_type === 'NDA' ? 'NDA' : d.document_type === 'TERM_SHEET' ? 'TS' : d.document_type === 'CONTRACT' ? 'CT' : 'DOC'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate">{d.file_name}</p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {d.document_type.replace('_', ' ')} · {fmtSize(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => handleDownload(d)}
                aria-label="Download"
                className="opacity-0 group-hover:opacity-100 transition size-7 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary flex items-center justify-center shrink-0"
              >
                <Icons.download className="size-3.5" />
              </button>
              <button
                onClick={() => handleDelete(d)}
                aria-label="Delete"
                className="opacity-0 group-hover:opacity-100 transition size-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center shrink-0"
              >
                <Icons.trash className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
