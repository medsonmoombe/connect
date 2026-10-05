import { describe, it, expect } from 'vitest';
import {
  makeTraceId,
  pickFields,
  sanitizeFilename,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  ERR,
} from '../api-helpers';

describe('makeTraceId', () => {
  it('returns a string starting with "req-"', () => {
    const id = makeTraceId();
    expect(id).toMatch(/^req-/);
  });

  it('returns a unique ID on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => makeTraceId()));
    expect(ids.size).toBe(100);
  });

  it('is at least 10 characters long', () => {
    expect(makeTraceId().length).toBeGreaterThanOrEqual(10);
  });
});

describe('pickFields', () => {
  it('picks only allowed fields from an object', () => {
    const obj = { name: 'Test', email: 'test@example.com', password: 'secret', role: 'ADMIN' };
    const result = pickFields(obj, ['name', 'email']);
    expect(result).toEqual({ name: 'Test', email: 'test@example.com' });
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('role');
  });

  it('skips fields not present in source object', () => {
    const obj = { name: 'Test' };
    const result = pickFields(obj, ['name', 'email']);
    expect(result).toEqual({ name: 'Test' });
  });

  it('returns empty object when no fields match', () => {
    const obj = { name: 'Test' };
    const result = pickFields(obj, ['email', 'role']);
    expect(result).toEqual({});
  });

  it('returns empty object from empty source', () => {
    const result = pickFields({}, ['name', 'email']);
    expect(result).toEqual({});
  });
});

describe('sanitizeFilename', () => {
  it('preserves safe filenames', () => {
    expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
    expect(sanitizeFilename('my-document_v2.xlsx')).toBe('my-document_v2.xlsx');
  });

  it('replaces dangerous characters with underscores', () => {
    expect(sanitizeFilename('hello/world.txt')).toBe('hello_world.txt');
    expect(sanitizeFilename('a<b>c:d.txt')).toBe('a_b_c_d.txt');
    expect(sanitizeFilename('file|name?.txt')).toBe('file_name_.txt');
  });

  it('collapses multiple dots', () => {
    expect(sanitizeFilename('report...pdf')).toBe('report.pdf');
    expect(sanitizeFilename('file..name..txt')).toBe('file.name.txt');
  });

  it('truncates to 200 characters', () => {
    const long = 'a'.repeat(150) + '.pdf';
    expect(sanitizeFilename(long)).toHaveLength(154); // a*150 + '.pdf' truncated to 200 limit
  });

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('');
  });

  it('handles filename with only dangerous characters', () => {
    // The 9 distinct dangerous chars get replaced with 9 underscores
    expect(sanitizeFilename('<>:"/\\|?*')).toBe('_________');
  });
});

describe('ALLOWED_MIME_TYPES', () => {
  it('includes PDF', () => {
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
  });

  it('includes common image types', () => {
    expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/webp')).toBe(true);
  });

  it('includes Office document types', () => {
    expect(ALLOWED_MIME_TYPES.has('application/msword')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/vnd.ms-excel')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true);
  });

  it('includes CSV', () => {
    expect(ALLOWED_MIME_TYPES.has('text/csv')).toBe(true);
  });

  it('does not include executable types', () => {
    expect(ALLOWED_MIME_TYPES.has('application/x-msdownload')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('application/x-sh')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('text/html')).toBe(false);
  });
});

describe('MAX_FILE_SIZE', () => {
  it('is 50MB (50 * 1024 * 1024)', () => {
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
  });
});

describe('ERR constants', () => {
  it('provides standard error code constants', () => {
    expect(ERR.UNAUTHORIZED).toBe('UNAUTHORIZED');
    expect(ERR.FORBIDDEN).toBe('FORBIDDEN');
    expect(ERR.NOT_FOUND).toBe('NOT_FOUND');
    expect(ERR.VALIDATION).toBe('VALIDATION');
    expect(ERR.CONFLICT).toBe('CONFLICT');
    expect(ERR.RATE_LIMITED).toBe('RATE_LIMITED');
    expect(ERR.INTERNAL).toBe('INTERNAL');
  });

  it('includes account/org-specific error codes', () => {
    expect(ERR.ACCOUNT_SUSPENDED).toBe('ACCOUNT_SUSPENDED');
    expect(ERR.ORG_DEACTIVATED).toBe('ORG_DEACTIVATED');
    expect(ERR.MFA_REQUIRED).toBe('MFA_REQUIRED');
    expect(ERR.PRECONDITION_FAILED).toBe('PRECONDITION_FAILED');
  });
});
