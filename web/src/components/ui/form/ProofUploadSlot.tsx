'use client';

import { useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/ui/icons';
import { ALLOWED_EXTENSIONS } from '@/lib/upload-constants';

interface ProofUploadSlotProps {
  label: string;
  file?: { file: File; type: string } | null;
  existingName?: string | null;
  error?: string;
  onSelect: (file: File) => void;
  onRemove?: () => void;
}

/**
 * File-attachment slot for proof documents: a two-state card that either
 * prompts for an upload (amber warn icon + Upload button) or shows the
 * attached file (green icon + name + Replace button). Designed for the
 * approval-card and Yes/No proof requirement contexts.
 */
export function ProofUploadSlot({
  label,
  file,
  existingName,
  error,
  onSelect,
  onRemove,
}: ProofUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const attached = !!file || !!existingName;

  console.log("FILE ::::", file);

  const runProgress = useCallback((selectedFile: File) => {
    setProgress(0);
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(100, p + 8 + Math.random() * 14);
      setProgress(Math.floor(p));
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          setProgress(null);
          onSelect(selectedFile);
        }, 220);
      }
    }, 100);
  }, [onSelect]);

  const isUploading = progress !== null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-amber-200 bg-amber-50/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "size-8 flex items-center justify-center shrink-0",
            attached
              ? "bg-[#E3F1E7] border border-g-line text-[#1F6B41]"
              : "bg-amber-100 text-amber-600",
          )}>
            {attached ? <Icons.check className="size-4" /> : <Icons.alertTriangle className="size-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#17251C] leading-none mb-1">{label}</p>
            <p className="text-[10px] text-[#5C6B61] font-medium truncate max-w-[170px]">
              {file ? file.file.name : existingName ? existingName : 'Required — attach proof'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {existingName && !file && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="h-7 px-2.5 border border-dashed border-[#D3DED5] bg-white text-[#5C6B61] hover:text-[#C63A2B] hover:border-[#D26A57] text-[10px] font-semibold flex items-center gap-1 transition-colors"
            >
              <Icons.trash className="size-3.5" />
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={() => !isUploading && inputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              "h-7 px-3 border flex items-center gap-1.5 text-[10px] font-semibold transition-colors",
              isUploading
                ? "border-[#D3DED5] bg-[#F6F8F6] text-[#8B998F] cursor-default"
                : attached
                  ? "border-[#BFDCC9] bg-[#E4F2E8] text-[#1F6B41] hover:bg-[#D9F2E0]"
                  : "border-amber-300 bg-white text-amber-700 hover:bg-[#FFFBEE]",
            )}
          >
            {isUploading
              ? <><Icons.spinner className="size-3.5 animate-spin" />{`Attaching… ${progress}%`}</>
              : attached
                ? <><Icons.refreshCw className="size-3.5" />Replace</>
                : <><Icons.upload className="size-3.5" />Upload</>}
          </button>
        </div>
      </div>
      {isUploading && (
        <div className="h-[2px] bg-black/[0.07] overflow-hidden">
          <div
            className="h-full transition-[width] duration-100 linear"
            style={{ width: `${progress}%`, background: '#D9A93F' }}
          />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        accept={ALLOWED_EXTENSIONS}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) runProgress(f);
          e.target.value = '';
        }}
      />
      {error && (
        <p className="text-[12px] font-medium text-[#B23A28] ml-1 flex items-center gap-1.5">
          <Icons.alertTriangle className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}