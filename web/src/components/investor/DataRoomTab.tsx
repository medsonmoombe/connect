'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Project, ProjectDocument } from '@/types';
import { storageService } from '@/lib/storage';
import { projectService } from '@/services/projects';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CLASSIFICATIONS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'] as const;

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PUBLIC:       { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100' },
  RESTRICTED:   { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100' },
  CONFIDENTIAL: { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100' },
};

interface DataRoomTabProps {
  projects: Project[];
  loading: boolean;
  isOwner?: boolean;
}

export function DataRoomTab({ projects, loading, isOwner = true }: DataRoomTabProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [classification, setClassification] = useState<string>('RESTRICTED');
  const [showClassMenu, setShowClassMenu] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const classMenuRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  useEffect(() => {
    const proj = projects.find(p => p.id === selectedProjectId);
    setDocs(proj?.documents ?? []);
  }, [selectedProjectId, projects]);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!showClassMenu) return;
    const handler = (e: MouseEvent) => {
      if (classMenuRef.current && !classMenuRef.current.contains(e.target as Node)) {
        setShowClassMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showClassMenu]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;
    setUploading(true);
    try {
      const result = await storageService.uploadProjectDocument(
        selectedProjectId,
        file,
        file.name,
        undefined,
        classification
      );
      const newDoc = await projectService.addProjectDocument({
        project_id: selectedProjectId,
        document_type: file.name,
        file_url: result.file_url,
        storage_path: result.storage_path,
        file_hash: result.file_hash,
        classification,
      });
      setDocs(prev => [newDoc, ...prev]);
      toast.success(`Uploaded "${file.name}"`);
    } catch (err: any) {
      if (err?.status === 409) {
        toast.error('Duplicate file — an identical file already exists in this project.');
      } else {
        toast.error(err?.message || 'Upload failed');
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !selectedProjectId) return;
    setDeleting(true);
    try {
      await projectService.deleteProjectDocument(deleteTarget.id, deleteTarget.storage_path, selectedProjectId);
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id));
      toast.success(`Deleted "${deleteTarget.document_type}"`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    if (!selectedProjectId) return;
    setDownloadingId(doc.id);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/documents/download?storage_path=${encodeURIComponent(doc.storage_path || '')}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Download failed');
      }
      const { signedUrl } = await res.json();
      window.open(signedUrl, '_blank');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download document');
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-white rounded-[32px] border border-gray-100">
        <Icons.spinner className="size-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!projects.length) {
    return (
      <EmptyState
        icon="folder"
        title="No Projects Yet"
        description="Create a project to start using the Data Room for secure document management."
        actionLabel="Create Project"
        actionHref="/dashboard/developer/submit"
      />
    );
  }

  const totalDocs = projects.reduce((acc, p) => acc + (p.documents?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-2">
        <div>
          <p className="dash-section-label mb-0.5">Secure Data Room</p>
          <h3 className="text-sm font-semibold text-slate-900">
            {totalDocs} document{totalDocs !== 1 ? 's' : ''} across {projects.length} project{projects.length !== 1 ? 's' : ''}
          </h3>
        </div>
      </div>

      {/* Project selector */}
      <div className="px-2">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Select Project</label>
        <div className="relative">
          <select
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            className="w-full h-10 px-4 pr-10 rounded-xl border border-gray-200 bg-white text-sm font-bold text-slate-900 appearance-none cursor-pointer hover:border-primary/30 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.documents?.length ?? 0} doc{(p.documents?.length ?? 0) !== 1 ? 's' : ''} · {p.project_size_mw} MW
              </option>
            ))}
          </select>
          <Icons.chevronDown className="size-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Document list */}
      {selectedProjectId && (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-soft overflow-hidden">
          {/* Toolbar */}
          <div className="p-5 border-b border-slate-50 flex items-center justify-between gap-4 bg-slate-50/30">
            <div className="flex items-center gap-3 min-w-0">
              <Icons.shieldCheck className="size-4 text-primary shrink-0" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest truncate">
                {selectedProject?.name ?? 'Project'} — Data Room
              </h4>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Classification picker — owner only */}
              {isOwner && (
                <div className="relative" ref={classMenuRef}>
                  <button
                    onClick={() => setShowClassMenu(!showClassMenu)}
                    className={cn(
                      'h-8 px-3 rounded-lg border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all',
                      CLASSIFICATION_COLORS[classification].bg,
                      CLASSIFICATION_COLORS[classification].text,
                      CLASSIFICATION_COLORS[classification].border
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {classification}
                  </button>
                  {showClassMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-30 py-1 min-w-[140px]">
                      {CLASSIFICATIONS.map(c => (
                        <button
                          key={c}
                          onClick={() => { setClassification(c); setShowClassMenu(false); }}
                          className={cn(
                            'w-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left hover:bg-slate-50 transition-colors flex items-center gap-2',
                            classification === c && 'bg-slate-50'
                          )}
                        >
                          <span className={cn('size-1.5 rounded-full', CLASSIFICATION_COLORS[c].text.replace('text-', 'bg-'))} />
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Upload — owner only */}
              {isOwner && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.pptx"
                  />
                  <Button
                    variant="outline"
                    className="h-8 px-3 rounded-lg border-slate-200 text-[10px] font-bold"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Icons.spinner className="size-3 animate-spin mr-1" /> : <Icons.plus className="size-3 mr-1" />}
                    Upload
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Documents */}
          {docs.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {docs.map(doc => {
                const cc = CLASSIFICATION_COLORS[doc.classification || 'RESTRICTED'];
                const isDownloading = downloadingId === doc.id;
                return (
                  <div key={doc.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/40 transition-colors group">
                    <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <Icons.fileText className="size-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                        {doc.document_type}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0',
                      cc.bg, cc.text, cc.border
                    )}>
                      {doc.classification || 'RESTRICTED'}
                    </span>
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Download — always visible */}
                      <button
                        onClick={() => handleDownload(doc)}
                        disabled={isDownloading}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
                        title="Download"
                      >
                        {isDownloading
                          ? <Icons.spinner className="size-3.5 animate-spin" />
                          : <Icons.download className="size-3.5" />
                        }
                      </button>
                      {/* Delete — owner only */}
                      {isOwner && (
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Icons.trash className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center">
              <div className="size-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Icons.fileText className="size-6 text-slate-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 mb-1">No Documents</h4>
              <p className="text-xs text-slate-400 font-medium">
                {isOwner ? 'Upload documents to this project\'s data room.' : 'No documents have been shared yet.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this document?"
        description={`"${deleteTarget?.document_type}" will be permanently removed. If AI scores exist, they will be invalidated.`}
        confirmLabel="Delete Document"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}
