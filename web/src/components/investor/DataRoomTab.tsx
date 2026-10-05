'use client';


import { useState, useEffect, useRef, useCallback } from 'react';
import { Icons } from '@/components/ui/icons';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Project, ProjectDocument } from '@/types';
import { storageService } from '@/lib/storage';
import { projectService } from '@/services/projects';
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } from '@/lib/upload-constants';
import { cn, formatUploadDate } from '@/lib/utils';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CLASSIFICATIONS = ['PUBLIC', 'RESTRICTED', 'CONFIDENTIAL'] as const;
type Classification = typeof CLASSIFICATIONS[number];

const MAX_FILE_SIZE_MB = 20;
const MAX_FILES = 10;

const CLASSIFICATION_CONFIG: Record<
  Classification,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  PUBLIC:       { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-100', dot: 'bg-green-500',  label: 'Public'       },
  RESTRICTED:   { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100', dot: 'bg-amber-500',  label: 'Restricted'   },
  CONFIDENTIAL: { bg: 'bg-red-50',    text: 'text-red-600',    border: 'border-red-100',   dot: 'bg-red-500',    label: 'Confidential' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StagedFile {
  file: File;
  key: string; // stable identity for React list rendering
}

interface DataRoomTabProps {
  projects: Project[];
  loading: boolean;
  isOwner?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  return name.includes('.') ? `.${name.split('.').pop()?.toLowerCase()}` : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// LoadingState
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="py-8 flex items-center justify-center bg-white rounded-none border border-gray-100">
      <Icons.spinner className="size-5 animate-spin text-primary" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyProjectsState
// ─────────────────────────────────────────────────────────────────────────────

function EmptyProjectsState() {
  return (
    <EmptyState
      icon="folder"
      title="No projects yet"
      description="Create a project to start using the data room for secure document management."
      actionLabel="Create project"
      actionHref="/developer/submit"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProjectSelector
// ─────────────────────────────────────────────────────────────────────────────

function ProjectSelector({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor="project-selector"
        className="block text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-1.5"
      >
        Active project
      </label>
      <div className="relative">
        <select
          id="project-selector"
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cn(
            'w-full h-10 px-4 pr-10 rounded-none border border-slate-200 bg-white',
            'text-sm font-semibold text-slate-900 appearance-none cursor-pointer',
            'hover:border-primary/30 focus:border-primary/50 focus:ring-2 focus:ring-primary/10',
            'outline-none transition-all'
          )}
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
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClassificationPicker
// ─────────────────────────────────────────────────────────────────────────────

function ClassificationPicker({
  value,
  onChange,
}: {
  value: Classification;
  onChange: (c: Classification) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = CLASSIFICATION_CONFIG[value];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'h-8 px-3 rounded-none border text-[10px] font-bold tracking-widest',
          'inline-flex items-center gap-1.5 transition-all hover:opacity-90',
          cfg.bg, cfg.text, cfg.border
        )}
      >
        <span className={cn('size-1.5 rounded-full', cfg.dot)} />
        {cfg.label}
        <Icons.chevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-100 rounded-none shadow-xl z-30 py-1.5 min-w-[148px] overflow-hidden">
          {CLASSIFICATIONS.map(c => {
            const cc = CLASSIFICATION_CONFIG[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className={cn(
                  'w-full px-3 py-2 text-[10px] font-bold tracking-widest text-left',
                  'flex items-center gap-2 transition-colors hover:bg-slate-50',
                  value === c && 'bg-slate-50'
                )}
              >
                <span className={cn('size-1.5 rounded-full shrink-0', cc.dot)} />
                <span className={cc.text}>{cc.label}</span>
                {value === c && <Icons.check className="size-3 text-primary ml-auto" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PanelToolbar
// ─────────────────────────────────────────────────────────────────────────────

function PanelToolbar({
  projectName,
  docCount,
  isOwner,
  classification,
  onClassificationChange,
  onUploadClick,
}: {
  projectName: string;
  docCount: number;
  isOwner: boolean;
  classification: Classification;
  onClassificationChange: (c: Classification) => void;
  onUploadClick: () => void;
}) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/40">
      <div className="flex items-center gap-3 min-w-0">
        <div className="size-8 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
          <Icons.shieldCheck className="size-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{projectName}</p>
          <p className="text-[10px] font-semibold text-slate-400 tracking-wider mt-0.5">
            {docCount} document{docCount !== 1 ? 's' : ''} stored
          </p>
        </div>
      </div>

      {isOwner && (
        <div className="flex items-center gap-2 shrink-0">
          <ClassificationPicker value={classification} onChange={onClassificationChange} />
          <button
            type="button"
            onClick={onUploadClick}
            className={cn(
              'h-8 px-3 rounded-none border border-slate-200 bg-white',
              'inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600',
              'hover:border-primary/30 hover:text-primary transition-all'
            )}
          >
            <Icons.upload className="size-3.5" />
            Upload documents
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DropZone
// Always visible inside the panel (owners only) — explicit drag target.
// ─────────────────────────────────────────────────────────────────────────────

function DropZone({
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: {
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload documents — drag and drop or click to browse"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className={cn(
        'mx-4 my-4 rounded-none border-2 border-dashed p-7',
        'flex flex-col items-center text-center cursor-pointer select-none',
        'transition-all',
        isDragging
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-slate-200 bg-slate-50/50 hover:border-primary/40 hover:bg-primary/[0.02]'
      )}
    >
      <div className={cn(
        'size-10 rounded-none flex items-center justify-center mb-3 transition-colors',
        isDragging ? 'bg-primary/10' : 'bg-white border border-slate-100'
      )}>
        <Icons.upload className={cn('size-5 transition-colors', isDragging ? 'text-primary' : 'text-slate-400')} />
      </div>
      <p className="text-sm font-semibold text-slate-700 mb-1">
        {isDragging ? 'Drop to upload' : 'Drag and drop files here'}
      </p>
      <p className="text-xs text-slate-400 font-medium">
        Up to {MAX_FILES} files · {MAX_FILE_SIZE_MB} MB each
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StagedFileList
// Files queued but not yet confirmed. Shown between DropZone and document list.
// ─────────────────────────────────────────────────────────────────────────────

function StagedFileList({
  staged,
  uploading,
  onConfirm,
  onCancel,
  onRemoveOne,
}: {
  staged: StagedFile[];
  uploading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onRemoveOne: (key: string) => void;
}) {
  if (staged.length === 0) return null;

  return (
    <div className="mx-4 mb-4 rounded-none border border-slate-100 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <p className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">
          {staged.length} file{staged.length !== 1 ? 's' : ''} ready to upload
        </p>
      </div>

      {/* File rows */}
      <div className="divide-y divide-slate-50">
        {staged.map(({ file, key }) => (
          <div key={key} className="flex items-center gap-3 px-4 py-3">
            <div className="size-8 rounded-none bg-primary/8 border border-primary/10 flex items-center justify-center shrink-0">
              <Icons.fileText className="size-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{file.name}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                {formatFileSize(file.size)} · {fileExtension(file.name)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemoveOne(key)}
              aria-label={`Remove ${file.name}`}
              className="p-1.5 rounded-none hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors shrink-0"
            >
              <Icons.x className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2.5 px-4 py-3 border-t border-slate-100 bg-slate-50/30">
        <button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          className="h-8 px-4 rounded-none border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={uploading}
          className={cn(
            'h-8 px-4 rounded-none text-xs font-bold text-white',
            'inline-flex items-center gap-1.5',
            'bg-primary hover:bg-primary/90 transition-colors disabled:opacity-60'
          )}
        >
          {uploading
            ? <><Icons.spinner className="size-3.5 animate-spin" /> Uploading…</>
            : <><Icons.check className="size-3.5" /> Upload {staged.length} file{staged.length !== 1 ? 's' : ''}</>}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DocumentRow
// ─────────────────────────────────────────────────────────────────────────────

function DocumentRow({
  doc,
  isOwner,
  isDownloading,
  onDownload,
  onDelete,
}: {
  doc: ProjectDocument;
  isOwner: boolean;
  isDownloading: boolean;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const classification = (doc.classification || 'RESTRICTED') as Classification;
  const cc = CLASSIFICATION_CONFIG[classification] ?? CLASSIFICATION_CONFIG.RESTRICTED;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors group">
      <div className="size-10 rounded-none bg-primary/8 border border-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
        <Icons.fileText className="size-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
          {doc.document_type}
        </p>
        <p className="text-[10px] font-medium text-slate-400 tracking-wider mt-0.5">
          Uploaded {formatUploadDate(doc.uploaded_at)}
        </p>
      </div>

      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'text-[10px] font-bold tracking-wider border shrink-0',
        cc.bg, cc.text, cc.border
      )}>
        <span className={cn('size-1.5 rounded-full', cc.dot)} />
        {cc.label}
      </span>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onDownload}
          disabled={isDownloading}
          aria-label="Download document"
          className="p-2 rounded-none hover:bg-primary/10 text-slate-400 hover:text-primary transition-colors disabled:opacity-50"
        >
          {isDownloading
            ? <Icons.spinner className="size-3.5 animate-spin" />
            : <Icons.download className="size-3.5" />}
        </button>

        {isOwner && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete document"
            className="p-2 rounded-none hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Icons.trash className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EmptyDocumentState
// ─────────────────────────────────────────────────────────────────────────────

function EmptyDocumentState({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="py-14 flex flex-col items-center text-center px-6">
      <div className="size-12 bg-slate-50 rounded-none flex items-center justify-center mb-4 border border-slate-100">
        <Icons.fileText className="size-5 text-slate-300" />
      </div>
      <h4 className="text-sm font-bold text-slate-700 mb-1.5">No documents yet</h4>
      <p className="text-xs text-slate-400 font-medium max-w-[220px] leading-relaxed">
        {isOwner
          ? 'Drag files into the upload area above to add them to this data room.'
          : 'No documents have been shared for this project yet.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PanelFooter
// ─────────────────────────────────────────────────────────────────────────────

function PanelFooter({ docCount }: { docCount: number }) {
  return (
    <div className="px-5 py-3 border-t border-slate-50 bg-slate-50/40 flex items-center justify-between">
      <p className="text-[10px] font-semibold text-slate-400 tracking-wider">
        {docCount} document{docCount !== 1 ? 's' : ''} stored
      </p>
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-semibold text-slate-400 tracking-wider">Encrypted at rest</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DocumentPanel
// Wraps toolbar + dropzone + staged list + document list + footer.
// Owns the file-input ref and drag state — nothing above needs to know about it.
// ─────────────────────────────────────────────────────────────────────────────

function DocumentPanel({
  project,
  docs,
  isOwner,
  classification,
  staged,
  uploading,
  downloadingId,
  requiredDocType,
  onClassificationChange,
  onStageFiles,
  onConfirmUpload,
  onCancelStaged,
  onRemoveStaged,
  onDownload,
  onDeleteRequest,
}: {
  project: Project;
  docs: ProjectDocument[];
  isOwner: boolean;
  classification: Classification;
  staged: StagedFile[];
  uploading: boolean;
  downloadingId: string | null;
  requiredDocType?: string;
  onClassificationChange: (c: Classification) => void;
  onStageFiles: (files: File[]) => void;
  onConfirmUpload: () => void;
  onCancelStaged: () => void;
  onRemoveStaged: (key: string) => void;
  onDownload: (doc: ProjectDocument) => void;
  onDeleteRequest: (doc: ProjectDocument) => void;
}) {
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pickFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const valid = Array.from(fileList).filter(f => {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`"${f.name}" exceeds ${MAX_FILE_SIZE_MB} MB and was skipped.`);
        return false;
      }
      if (!ALLOWED_MIME_TYPES.has(f.type)) {
        toast.error(`"${f.name}" is not an accepted file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, CSV, PNG, JPG, GIF, WEBP.`);
        return false;
      }
      return true;
    });
    if (valid.length) onStageFiles(valid);
  };

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop      = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); pickFiles(e.dataTransfer.files); };
  const handleInput     = (e: React.ChangeEvent<HTMLInputElement>) => pickFiles(e.target.files);
  const openPicker      = () => fileInputRef.current?.click();

  return (
    <div className="relative bg-white rounded-none border border-slate-100 shadow-soft overflow-hidden">
      {/* Hidden native file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_EXTENSIONS}
        className="sr-only"
        aria-hidden
        onChange={handleInput}
        onClick={e => { (e.target as HTMLInputElement).value = ''; }}
      />

      {/* ① Toolbar */}
      <PanelToolbar
        projectName={project.name}
        docCount={docs.length}
        isOwner={isOwner}
        classification={classification}
        onClassificationChange={onClassificationChange}
        onUploadClick={openPicker}
      />

      {/* Context banner — shown when navigating from Stage Gate */}
      {requiredDocType && (
        <div className="mx-4 mt-4 p-3 rounded-none bg-amber-50 border border-amber-100 flex items-center gap-3">
          <div className="size-8 rounded-none bg-amber-100 flex items-center justify-center shrink-0">
            <Icons.fileText className="size-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800">Required document: {requiredDocType}</p>
            <p className="text-[10px] text-amber-600 font-medium mt-0.5">
              Upload this document for <span className="font-bold">{project.name}</span> to advance to the next stage.
            </p>
          </div>
        </div>
      )}

      {/* ② Drop zone — always visible for owners */}
      {isOwner && (
        <DropZone
          isDragging={isDragging}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openPicker}
        />
      )}

      {/* ③ Staged file list (only when files are queued) */}
      <StagedFileList
        staged={staged}
        uploading={uploading}
        onConfirm={onConfirmUpload}
        onCancel={onCancelStaged}
        onRemoveOne={onRemoveStaged}
      />

      {/* Divider between upload area and stored docs */}
      {docs.length > 0 && isOwner && (
        <div className="mx-5 border-t border-slate-100" />
      )}

      {/* ④ Stored documents */}
      {docs.length > 0 ? (
        <div className="divide-y divide-slate-50">
          {docs.map(doc => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              isOwner={isOwner}
              isDownloading={downloadingId === doc.id}
              onDownload={() => onDownload(doc)}
              onDelete={() => onDeleteRequest(doc)}
            />
          ))}
        </div>
      ) : (
        <EmptyDocumentState isOwner={isOwner} />
      )}

      {/* ⑤ Footer */}
      {docs.length > 0 && <PanelFooter docCount={docs.length} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DataRoomTab — root (data + state orchestration only)
// ─────────────────────────────────────────────────────────────────────────────

export function DataRoomTab({ projects, loading, isOwner = true, initialProjectId, onDocumentsChanged, requiredDocType }: DataRoomTabProps & { initialProjectId?: string; onDocumentsChanged?: () => void; requiredDocType?: string }) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [docs,              setDocs]              = useState<ProjectDocument[]>([]);
  const [classification,    setClassification]    = useState<Classification>('RESTRICTED');
  const [staged,            setStaged]            = useState<StagedFile[]>([]);
  const [uploading,         setUploading]         = useState(false);
  const [deleteTarget,      setDeleteTarget]      = useState<ProjectDocument | null>(null);
  const [deleting,          setDeleting]          = useState(false);
  const [downloadingId,     setDownloadingId]     = useState<string | null>(null);

  // ── Sync docs when selection or projects change ───────────────────────────
  useEffect(() => {
    const proj = projects.find(p => p.id === selectedProjectId);
    setDocs(proj?.documents ?? []);
    setStaged([]); // clear queue when switching project
  }, [selectedProjectId, projects]);

  // ── Sync initial project ID from props (e.g. from URL param) ─────────────
  useEffect(() => {
    if (initialProjectId && initialProjectId !== selectedProjectId) {
      setSelectedProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  // ── Auto-select first project ─────────────────────────────────────────────
  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // ── Stage files (dedupe + size-guard already happen in DocumentPanel) ─────
  const handleStageFiles = useCallback((files: File[]) => {
    setStaged(prev => {
      const existingNames = new Set([
        ...prev.map(s => s.file.name),
        ...docs.map(d => d.document_type),
      ]);
      const incoming = files
        .filter(f => {
          if (existingNames.has(f.name)) {
            toast.error(`"${f.name}" is already queued or uploaded.`);
            return false;
          }
          return true;
        })
        .map(f => ({ file: f, key: `${f.name}-${Date.now()}-${Math.random()}` }));

      const combined = [...prev, ...incoming];
      if (combined.length > MAX_FILES) {
        toast.error(`You can upload at most ${MAX_FILES} files at a time.`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }, [docs]);

  const handleRemoveStaged  = useCallback((key: string) => setStaged(prev => prev.filter(s => s.key !== key)), []);
  const handleCancelStaged  = useCallback(() => setStaged([]), []);

  // ── Confirm upload — all staged files, sequentially ───────────────────────
  const handleConfirmUpload = useCallback(async () => {
    if (!selectedProjectId || staged.length === 0) return;
    setUploading(true);
    const uploaded: ProjectDocument[] = [];

    for (const { file } of staged) {
      try {
        // Upload under the same document_type the row is created with, so the
        // server's slot-scoped duplicate check matches the stored row.
        const result = await storageService.uploadProjectDocument(
          selectedProjectId, file, requiredDocType ?? file.name, undefined, classification
        );
        const newDoc = await projectService.addProjectDocument({
          project_id:    selectedProjectId,
          document_type: requiredDocType ?? file.name,
          file_url:      result.file_url,
          storage_path:  result.storage_path,
          file_hash:     result.file_hash,
          mime_type:     result.mime_type ?? file.type,
          classification,
        });
        uploaded.push(newDoc);
        toast.success(`Uploaded "${file.name}"`);
      } catch (err: any) {
        if (err?.status === 409) {
          toast.error(`"${file.name}" is a duplicate — an identical file already exists.`);
        } else {
          toast.error(err?.message || `Failed to upload "${file.name}".`);
        }
      }
    }

    if (uploaded.length > 0) {
      setDocs(prev => [...uploaded, ...prev]);
      onDocumentsChanged?.();
    }
    setStaged([]);
    setUploading(false);
  }, [selectedProjectId, staged, classification, onDocumentsChanged, requiredDocType]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget || !selectedProjectId) return;
    setDeleting(true);
    try {
      await projectService.deleteProjectDocument(
        deleteTarget.id, deleteTarget.storage_path, selectedProjectId
      );
      setDocs(prev => prev.filter(d => d.id !== deleteTarget.id));
      onDocumentsChanged?.();
      toast.success(`Deleted "${deleteTarget.document_type}"`);
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete document. Please try again.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, selectedProjectId, onDocumentsChanged]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async (doc: ProjectDocument) => {
    if (!selectedProjectId) return;
    setDownloadingId(doc.id);
    try {
      const res = await fetch(
        `/api/projects/${selectedProjectId}/documents/download?storage_path=${encodeURIComponent(doc.storage_path || '')}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Download failed.');
      }
      const { signedUrl } = await res.json();
      window.open(signedUrl, '_blank');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download document.');
    } finally {
      setDownloadingId(null);
    }
  }, [selectedProjectId]);

  // ── Render gates ──────────────────────────────────────────────────────────
  if (loading)          return <LoadingState />;
  if (!projects.length) return <EmptyProjectsState />;

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const totalDocs       = projects.reduce((s, p) => s + (p.documents?.length ?? 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="dash-section-label mb-0.5">Secure data room</p>
          <h3 className="text-sm font-semibold text-slate-900">
            {totalDocs} document{totalDocs !== 1 ? 's' : ''} across{' '}
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </h3>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-primary/8 border border-primary/10 shrink-0">
          <Icons.shieldCheck className="size-3.5 text-primary" />
          <span className="text-[10px] font-bold text-primary tracking-widest">Encrypted</span>
        </div>
      </div>

      {/* Project selector */}
      <ProjectSelector
        projects={projects}
        value={selectedProjectId}
        onChange={id => setSelectedProjectId(id)}
      />

      {/* Main panel */}
      {selectedProject && (
        <DocumentPanel
          project={selectedProject}
          docs={docs}
          isOwner={isOwner}
          classification={classification}
          staged={staged}
          uploading={uploading}
          downloadingId={downloadingId}
          requiredDocType={requiredDocType}
          onClassificationChange={setClassification}
          onStageFiles={handleStageFiles}
          onConfirmUpload={handleConfirmUpload}
          onCancelStaged={handleCancelStaged}
          onRemoveStaged={handleRemoveStaged}
          onDownload={handleDownload}
          onDeleteRequest={setDeleteTarget}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete this document?"
        description={`"${deleteTarget?.document_type}" will be permanently removed. Any AI scores derived from this file will be invalidated.`}
        confirmLabel="Delete document"
        confirmVariant="danger"
        loading={deleting}
      />
    </div>
  );
}