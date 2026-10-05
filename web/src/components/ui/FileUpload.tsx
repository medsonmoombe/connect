'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MAX_FILE_SIZE, ALLOWED_MIME_TYPES, ALLOWED_MIME_ARRAY } from '@/lib/upload-constants';

// ── Constants ──────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.png,.jpg,.jpeg,.gif,.webp';

const MIME_ICONS: Record<string, string> = {
  pdf: 'fileText',
  doc: 'fileText',
  docx: 'fileText',
  xls: 'fileSpreadsheet',
  xlsx: 'fileSpreadsheet',
  ppt: 'presentation',
  pptx: 'presentation',
  csv: 'fileSpreadsheet',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
};

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

function getFileIcon(filename: string): string {
  const ext = getExtension(filename);
  return MIME_ICONS[ext] ?? 'file';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface FilePreview {
  /** Unique client-side id (UUID or timestamp). */
  id: string;
  file: File;
  /** Validation error message, or null if valid. */
  error: string | null;
}

export interface FileUploadProps {
  /** Called after the user confirms the files. Returns an array of results. */
  onUpload: (files: File[]) => Promise<void>;
  /** Max number of files allowed (default 1). */
  maxFiles?: number;
  /** Allow multiple file selection (default false). */
  multiple?: boolean;
  /** Called when upload starts / ends. */
  onUploadStateChange?: (uploading: boolean) => void;
  /** Extra className for the drop zone. */
  className?: string;
  /** Label text for the drop zone. */
  label?: string;
  /** Accepted MIME types (default all allowed). */
  accept?: string;
  /** Max file size in bytes (default 50MB). */
  maxFileSize?: number;
  /** Existing file count (for enforcing maxFiles across re-uploads). */
  existingCount?: number;
  /** Disable the upload entirely. */
  disabled?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function FileUpload({
  onUpload,
  maxFiles = 1,
  multiple = false,
  onUploadStateChange,
  className,
  label = 'Drag files here or click to browse',
  accept = ALLOWED_EXTENSIONS,
  maxFileSize = MAX_FILE_SIZE,
  existingCount = 0,
  disabled = false,
}: FileUploadProps) {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const remaining = maxFiles - existingCount;

  // Inner callback wrapper
  const setUploadingState = useCallback(
    (v: boolean) => {
      setUploading(v);
      onUploadStateChange?.(v);
    },
    [onUploadStateChange],
  );

  // Validate a single file
  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return `"${file.name}" is not an accepted file type. Accepted: PDF, images, Word, Excel, PowerPoint, CSV.`;
      }
      if (file.size > maxFileSize) {
        return `"${file.name}" exceeds the ${formatSize(maxFileSize)} size limit (${formatSize(file.size)}).`;
      }
      return null;
    },
    [maxFileSize],
  );

  // Process files from input / drop
  const processFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (disabled) return;
      const arr = Array.from(incoming);

      // Enforce maxFiles limit
      if (arr.length > remaining) {
        toast.error(`You can upload up to ${maxFiles} file${maxFiles !== 1 ? 's' : ''} (${remaining} remaining).`);
        arr.splice(remaining);
      }

      const newPreviews: FilePreview[] = arr.map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        error: validateFile(file),
      }));

      setPreviews((prev) => {
        const combined = [...prev, ...newPreviews];
        // Trim to maxFiles
        if (combined.length > remaining) {
          toast.error(`Maximum ${maxFiles} file${maxFiles !== 1 ? 's' : ''} allowed.`);
          return combined.slice(0, remaining);
        }
        return combined;
      });
    },
    [disabled, remaining, maxFiles, validateFile],
  );

  // Remove a preview
  const removePreview = useCallback((id: string) => {
    setPreviews((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Confirm and upload
  const handleConfirm = useCallback(async () => {
    const valid = previews.filter((p) => !p.error);
    if (valid.length === 0) {
      toast.error('No valid files to upload.');
      return;
    }
    setUploadingState(true);
    try {
      await onUpload(valid.map((p) => p.file));
      setPreviews([]);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploadingState(false);
    }
  }, [previews, onUpload, setUploadingState]);

  // Cancel all
  const handleCancel = useCallback(() => {
    setPreviews([]);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden input */}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        multiple={multiple && remaining > 1}
        accept={accept}
        disabled={disabled || uploading || remaining <= 0}
        onChange={(e) => {
          if (e.target.files?.length) processFiles(e.target.files);
        }}
      />

      {/* Drop zone */}
      {remaining > 0 && (
        <div
          onDragOver={(e) => {
            if (!disabled) { e.preventDefault(); setDragOver(true); }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!disabled && e.dataTransfer.files?.length) processFiles(e.dataTransfer.files);
          }}
          onClick={() => !disabled && !uploading && remaining > 0 && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled && !uploading && remaining > 0) fileRef.current?.click();
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-1.5 h-24 rounded-none border-2 border-dashed cursor-pointer transition',
            disabled || uploading
              ? 'border-[#E3EAE4] bg-[#F4FAF5] cursor-not-allowed opacity-60'
              : dragOver
                ? 'border-g-700 bg-g-soft'
                : 'border-[#CFDAD3] bg-[#F7FAF7] hover:border-g-700/50 hover:bg-g-soft/60',
          )}
        >
          {uploading ? (
            <><Icons.spinner className="size-5 animate-spin text-primary" /><span className="text-xs font-bold text-slate-500">Uploading…</span></>
          ) : (
            <>
              <Icons.upload className="size-5 text-slate-400" />
              <span className="text-xs font-bold text-slate-500 text-center px-2">
                {remaining < maxFiles
                  ? `${label} (${remaining} of ${maxFiles} remaining)`
                  : label}
              </span>
              {maxFiles > 1 && (
                <span className="text-[10px] text-slate-400 font-medium">Up to {maxFiles} files · {formatSize(maxFileSize)} max each</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Remaining count indicator */}
      {remaining <= 0 && !uploading && (
        <div className="flex items-center justify-center gap-2 h-12 rounded-none border-2 border-dashed border-slate-200 bg-slate-50/50">
          <Icons.checkCircle className="size-4 text-green-500" />
          <span className="text-xs font-bold text-slate-500">Maximum {maxFiles} file{maxFiles !== 1 ? 's' : ''} reached</span>
        </div>
      )}

      {/* Preview cards */}
      {previews.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {previews.filter((p) => !p.error).length} file{previews.filter((p) => !p.error).length !== 1 ? 's' : ''} ready to upload
          </p>
          <ul className="space-y-1.5">
            {previews.map((p) => {
              const ext = getExtension(p.file.name);
              const isInvalid = !!p.error;
              return (
                <li
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-none border transition group',
                    isInvalid
                      ? 'border-red-200 bg-red-50'
                      : 'border-slate-100 bg-white hover:bg-slate-50',
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'size-8 rounded-none flex items-center justify-center shrink-0 border',
                      isInvalid ? 'border-red-200 text-red-500 bg-red-100' : 'border-slate-200 text-slate-500 bg-slate-50',
                    )}
                  >
                    <Icons.fileText className="size-4" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-semibold truncate', isInvalid ? 'text-red-700' : 'text-slate-800')}>
                      {p.file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn('text-[10px] font-medium', isInvalid ? 'text-red-500' : 'text-slate-400')}>
                        {formatSize(p.file.size)} · .{ext}
                      </span>
                      {isInvalid && (
                        <span className="text-[9px] font-bold text-red-600 uppercase tracking-wider">Invalid</span>
                      )}
                    </div>
                    {p.error && <p className="text-[10px] text-red-500 mt-0.5 leading-tight">{p.error}</p>}
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removePreview(p.id)}
                    disabled={uploading}
                    className="size-7 rounded-none hover:bg-red-50 text-slate-400 hover:text-red-600 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition"
                  >
                    <Icons.x className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              onClick={handleConfirm}
              disabled={uploading || previews.every((p) => !!p.error)}
              className="h-8 px-4 rounded-none text-xs font-bold"
              icon={uploading ? <Icons.spinner className="size-3.5 animate-spin" /> : <Icons.check className="size-3.5" />}
            >
              {uploading ? 'Uploading…' : `Upload ${previews.filter((p) => !p.error).length} file${previews.filter((p) => !p.error).length !== 1 ? 's' : ''}`}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={uploading}
              className="h-8 px-4 rounded-none text-xs font-bold"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
