import { describe, it, expect } from 'vitest';
import { mimeFromFileName, sniffFileTypeMismatch, ALLOWED_EXTENSIONS } from '../upload-constants';

describe('mimeFromFileName', () => {
  it('maps common extensions to MIME types', () => {
    expect(mimeFromFileName('report.pdf')).toBe('application/pdf');
    expect(mimeFromFileName('photo.JPG')).toBe('image/jpeg');
    expect(mimeFromFileName('scan.png')).toBe('image/png');
    expect(mimeFromFileName('model.xlsx')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(mimeFromFileName('study.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(mimeFromFileName('data.csv')).toBe('text/csv');
  });

  it('handles storage paths with timestamp prefixes', () => {
    expect(mimeFromFileName('abc-123/1712345678901_report.PDF')).toBe('application/pdf');
  });

  it('returns null for unknown extensions', () => {
    expect(mimeFromFileName('archive.zip')).toBeNull();
    expect(mimeFromFileName('file.exe')).toBeNull();
    expect(mimeFromFileName('noextension')).toBeNull();
  });
});

describe('sniffFileTypeMismatch', () => {
  it('accepts a genuine PDF', () => {
    const pdf = Buffer.from('%PDF-1.4\n...fake content...');
    expect(sniffFileTypeMismatch(pdf, 'application/pdf')).toBeNull();
  });

  it('rejects a renamed file masquerading as PDF', () => {
    const exe = Buffer.from('MZ\x90\x00... not a pdf at all');
    expect(sniffFileTypeMismatch(exe, 'application/pdf')).toContain('not a valid PDF');
  });

  it('accepts PNG and JPEG by magic bytes', () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('data')]);
    expect(sniffFileTypeMismatch(png, 'image/png')).toBeNull();

    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('data')]);
    expect(sniffFileTypeMismatch(jpeg, 'image/jpeg')).toBeNull();
  });

  it('rejects an image claiming to be PNG when it is not', () => {
    const notPng = Buffer.from('not a png file!');
    expect(sniffFileTypeMismatch(notPng, 'image/png')).toContain('not a valid PNG');
  });

  it('accepts Office Open XML (zip container) files', () => {
    const zip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('content')]);
    expect(sniffFileTypeMismatch(zip, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeNull();
    expect(sniffFileTypeMismatch(zip, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBeNull();
  });

  it('accepts legacy OLE2 office binaries (.doc/.xls)', () => {
    const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.from('content')]);
    expect(sniffFileTypeMismatch(ole, 'application/msword')).toBeNull();
    expect(sniffFileTypeMismatch(ole, 'application/vnd.ms-excel')).toBeNull();
  });

  it('does not reject text/csv (no reliable magic)', () => {
    expect(sniffFileTypeMismatch(Buffer.from('a,b,c'), 'text/csv')).toBeNull();
  });

  it('returns null for tiny buffers (under the sniff window)', () => {
    expect(sniffFileTypeMismatch(Buffer.from('%PDF'), 'application/pdf')).toBeNull();
  });
});

describe('ALLOWED_EXTENSIONS', () => {
  it('covers every allowed extension', () => {
    expect(ALLOWED_EXTENSIONS).toContain('.pdf');
    expect(ALLOWED_EXTENSIONS).toContain('.docx');
    expect(ALLOWED_EXTENSIONS).toContain('.xlsx');
    expect(ALLOWED_EXTENSIONS).toContain('.csv');
    expect(ALLOWED_EXTENSIONS).toContain('.png');
  });
});
