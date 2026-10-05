import type { NormalizedContent } from './types';
import { AIProviderError } from './types';

const MAX_PAGES = 25;
/** Minimum chars/page to consider a PDF text-based (not scanned). */
const SCANNED_CHARS_PER_PAGE = 100;
const MAX_SHEETS = 3;

/**
 * Normalize a raw document buffer into a NormalizedContent object that
 * providers can consume. Providers never see raw bytes — only text or
 * base64-encoded images.
 *
 * Routing:
 *  - Text PDF  → local text extraction via unpdf (cheapest, no vision tokens)
 *  - Scanned PDF → render pages to PNG images → vision path
 *  - Image (jpg/png/webp/gif) → vision path
 *  - DOCX → mammoth text extraction
 *  - XLSX/XLS/CSV → xlsx text extraction
 *  - Fallback → UTF-8 decode
 */
export async function normalizeDocument(
  file: { bytes: ArrayBuffer; mimeType: string; name: string },
  maxChars: number,
): Promise<NormalizedContent> {
  const meta: NormalizedContent['meta'] = {
    ocrUsed: false,
    truncated: false,
    originalChars: 0,
  };

  // ── PDF ──────────────────────────────────────────────────────────────────
  if (file.mimeType === 'application/pdf') {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(file.bytes));
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      meta.pages = totalPages;
      meta.originalChars = text.length;

      const charsPerPage = text.length / Math.max(totalPages, 1);
      if (charsPerPage >= SCANNED_CHARS_PER_PAGE) {
        const { capped, truncated } = capText(text, maxChars);
        meta.truncated = truncated;
        return { kind: 'text', text: capped, meta };
      }
    } catch {
      // unpdf failed — fall through to vision path
    }
    return renderPdfPagesToImages(file.bytes, meta);
  }

  // ── Images ───────────────────────────────────────────────────────────────
  if (file.mimeType.startsWith('image/')) {
    return {
      kind: 'vision',
      images: [{ mimeType: file.mimeType, base64: Buffer.from(file.bytes).toString('base64') }],
      meta,
    };
  }

  // ── DOCX ─────────────────────────────────────────────────────────────────
  if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) });
      meta.originalChars = value.length;
      const { capped, truncated } = capText(value, maxChars);
      meta.truncated = truncated;
      return { kind: 'text', text: capped, meta };
    } catch {
      return { kind: 'text', text: '[DOCX could not be parsed]', meta };
    }
  }

  // ── XLSX / XLS / CSV ─────────────────────────────────────────────────────
  if (
    file.mimeType.includes('spreadsheet') ||
    file.mimeType.includes('excel') ||
    file.mimeType === 'text/csv'
  ) {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(file.bytes);
      let text = '';
      for (const name of wb.SheetNames.slice(0, MAX_SHEETS)) {
        text += `\n--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`;
      }
      meta.originalChars = text.length;
      const { capped, truncated } = capText(text, maxChars);
      meta.truncated = truncated;
      return { kind: 'text', text: capped, meta };
    } catch {
      return { kind: 'text', text: '[Spreadsheet could not be parsed]', meta };
    }
  }

  // ── Plain text fallback ───────────────────────────────────────────────────
  const text = new TextDecoder().decode(file.bytes);
  meta.originalChars = text.length;
  const { capped, truncated } = capText(text, maxChars);
  meta.truncated = truncated;
  return { kind: 'text', text: capped, meta };
}

async function renderPdfPagesToImages(
  bytes: ArrayBuffer,
  meta: NormalizedContent['meta'],
): Promise<NormalizedContent> {
  try {
    const { pdf } = await import('pdf-to-img');
    const doc = await pdf(Buffer.from(bytes), { scale: 2 });
    const images: { mimeType: string; base64: string }[] = [];
    let i = 0;
    for await (const png of doc) {
      if (i >= MAX_PAGES) { meta.truncated = true; break; }
      images.push({ mimeType: 'image/png', base64: (png as Buffer).toString('base64') });
      i++;
    }
    meta.pages = i;
    return { kind: 'vision', images, meta };
  } catch {
    throw new AIProviderError(
      'UNSUPPORTED_CONTENT',
      'Scanned PDF could not be rendered for vision analysis — pdf-to-img may not be installed',
    );
  }
}

function capText(text: string, maxChars: number): { capped: string; truncated: boolean } {
  if (text.length <= maxChars) return { capped: text, truncated: false };
  // Keep head (70%) + tail (30%): structure lives at both ends
  const head = Math.floor(maxChars * 0.7);
  const tail = maxChars - head;
  return {
    capped: text.slice(0, head) + '\n\n[...TRUNCATED...]\n\n' + text.slice(-tail),
    truncated: true,
  };
}
