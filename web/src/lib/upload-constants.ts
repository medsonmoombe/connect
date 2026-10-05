/**
 * Shared upload constraints — single source of truth for client + server.
 */

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
]);

export const ALLOWED_MIME_ARRAY = Array.from(ALLOWED_MIME_TYPES);

/** File-picker accept string mirroring ALLOWED_MIME_TYPES. */
export const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.png,.jpg,.jpeg,.gif,.webp';

/** Extension (lowercase, no dot) → MIME type — used to recover the content type of legacy uploads. */
const EXTENSION_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv',
};

/** Infer the MIME type from a filename (e.g. 'report.PDF' → 'application/pdf'), or null when unknown. */
export function mimeFromFileName(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_MIME[ext] ?? null;
}

/**
 * Magic-byte check: verify the file header matches its declared MIME type so a
 * renamed .exe/.html cannot masquerade as an allowed document. Returns null
 * when the header matches (or the type has no reliable header signature).
 */
export function sniffFileTypeMismatch(buffer: Buffer, declaredMime: string): string | null {
  if (!buffer || buffer.length < 8) return null;
  const head = buffer.subarray(0, 8);

  switch (declaredMime) {
    case 'application/pdf':
      return buffer.subarray(0, 4).toString('latin1') === '%PDF' ? null : 'content is not a valid PDF';
    case 'image/png':
      return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? null : 'content is not a valid PNG image';
    case 'image/jpeg':
      return head.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? null : 'content is not a valid JPEG image';
    case 'image/gif':
      return head.subarray(0, 4).toString('latin1') === 'GIF8' ? null : 'content is not a valid GIF image';
    case 'image/webp':
      return head.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP' ? null : 'content is not a valid WEBP image';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      // Office Open XML files are ZIP containers
      return head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) || head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
        ? null
        : 'content is not a valid Office (.docx/.xlsx/.pptx) file';
    case 'application/msword':
    case 'application/vnd.ms-excel':
    case 'application/vnd.ms-powerpoint':
      // Legacy binary Office files use the OLE2 container
      return head.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])) ? null : 'content is not a valid Office (.doc/.xls/.ppt) file';
    case 'text/csv':
      // Text files have no reliable magic — skip
      return null;
    default:
      return null;
  }
}
