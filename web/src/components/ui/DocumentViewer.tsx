'use client';

import { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Serve the worker from /public — no module bundler involved, no version mismatch
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

export interface DocumentViewerProps {
  projectId: string;
  storagePath: string;
  label?: string;
  mimeType?: string | null;
  onClose: () => void;
}

type ViewerMode = 'pdf' | 'image' | 'unsupported';

function modeFromMime(mime?: string | null, path?: string): ViewerMode {
  const m = (mime ?? '').toLowerCase();
  const ext = (path ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (m.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  return 'unsupported';
}

export function DocumentViewer({ projectId, storagePath, label, mimeType, onClose }: DocumentViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [downloading, setDownloading] = useState(false);
  const [visible, setVisible] = useState(false);

  const mode = modeFromMime(mimeType, storagePath);
  const fileName = label || storagePath.split('/').pop() || 'document';

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    setLoadError(null);
    fetch(`/api/projects/${projectId}/documents/download?storage_path=${encodeURIComponent(storagePath)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || `Access denied (${res.status})`);
        }
        const { signedUrl: url } = await res.json();
        if (!cancelled) setSignedUrl(url);
      })
      .catch((err) => { if (!cancelled) setLoadError(err.message || 'Failed to load document'); })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [projectId, storagePath]);

  const handleDownload = async () => {
    if (!signedUrl || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(signedUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(signedUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className={cn('flex-1 bg-black/40 transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className={cn(
        'w-1/2 min-w-[480px] max-w-3xl flex flex-col bg-white shadow-2xl transition-transform duration-300',
        visible ? 'translate-x-0' : 'translate-x-full',
      )}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3.5 border-b border-white/15 bg-[#0b3b24] px-[22px] py-[17px]">
          <Icons.fileText className="size-4 text-emerald-200/70 shrink-0" />
          <p className="flex-1 text-sm font-bold text-white truncate">{fileName}</p>

          <div className="flex items-center gap-1 ml-auto">
            {mode === 'pdf' && numPages > 0 && (
              <div className="flex items-center gap-1 mr-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                  className="size-7 flex items-center justify-center text-emerald-200/70 hover:text-white disabled:opacity-30 transition-colors">
                  <Icons.chevronLeft className="size-4" />
                </button>
                <span className="text-[11px] font-bold text-emerald-200/70 tabular-nums min-w-[52px] text-center">
                  {currentPage} / {numPages}
                </span>
                <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}
                  className="size-7 flex items-center justify-center text-emerald-200/70 hover:text-white disabled:opacity-30 transition-colors">
                  <Icons.chevronRight className="size-4" />
                </button>
                <div className="w-px h-4 bg-white/20 mx-1" />
                <button onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
                  className="size-7 flex items-center justify-center text-emerald-200/70 hover:text-white transition-colors">
                  <Icons.zoomOut className="size-3.5" />
                </button>
                <span className="text-[10px] font-bold text-emerald-200/50 w-9 text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setScale(s => Math.min(2.5, +(s + 0.25).toFixed(2)))}
                  className="size-7 flex items-center justify-center text-emerald-200/70 hover:text-white transition-colors">
                  <Icons.zoomIn className="size-3.5" />
                </button>
                <div className="w-px h-4 bg-white/20 mx-1" />
              </div>
            )}

            <button onClick={handleDownload} disabled={!signedUrl || downloading}
              className="h-7 px-3 flex items-center gap-1.5 text-[10px] font-bold text-emerald-200/70 hover:text-white border border-white/15 hover:border-white/30 transition-colors disabled:opacity-40">
              {downloading ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.download className="size-3.5" />}
              Download
            </button>

            <button onClick={handleClose}
              className="size-7 flex items-center justify-center text-emerald-200/70 hover:text-white transition-colors ml-1">
              <Icons.x className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-100 flex flex-col items-center p-4">
          {fetching && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3">
              <Icons.spinner className="size-8 animate-spin text-slate-400" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading…</p>
            </div>
          )}

          {!fetching && loadError && (
            <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
              <div className="size-12 bg-red-50 border border-red-200 flex items-center justify-center">
                <Icons.alertTriangle className="size-6 text-red-500" />
              </div>
              <p className="text-sm font-bold text-slate-700">Cannot load document</p>
              <p className="text-xs text-slate-500 max-w-xs">{loadError}</p>
            </div>
          )}

          {!fetching && !loadError && signedUrl && (
            <>
              {mode === 'pdf' && (
                <Document
                  file={signedUrl}
                  onLoadSuccess={({ numPages: n }) => { setNumPages(n); setCurrentPage(1); }}
                  onLoadError={(err) => setLoadError(err.message)}
                  loading={
                    <div className="flex items-center gap-2 py-20 text-slate-400">
                      <Icons.spinner className="size-5 animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-widest">Rendering PDF…</span>
                    </div>
                  }
                >
                  <Page pageNumber={currentPage} scale={scale} className="shadow-lg" renderTextLayer renderAnnotationLayer />
                </Document>
              )}

              {mode === 'image' && (
                <img src={signedUrl} alt={fileName} className="max-w-full shadow-lg object-contain"
                  onError={() => setLoadError('Image could not be loaded')} />
              )}

              {mode === 'unsupported' && (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
                  <div className="size-14 bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <Icons.fileText className="size-7 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Preview not available</p>
                    <p className="text-xs text-slate-500 max-w-xs mb-4">This file type cannot be previewed. Download it to view.</p>
                    <button onClick={handleDownload}
                      className="h-9 px-5 bg-[#0b3b24] text-white text-xs font-bold hover:bg-[#0d4a2e] transition-colors inline-flex items-center gap-2">
                      <Icons.download className="size-3.5" /> Download File
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
