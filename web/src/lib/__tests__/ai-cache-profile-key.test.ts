import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { projectProfileKey, type ProjectProfile } from '../ai/prompt';

/**
 * The per-document evidence cache is keyed on the file hash. But the extraction
 * verdict (`belongs_to_project` / `contradicts_project`) is relative to the
 * project profile embedded in the prompt — so editing capacity/name/location
 * must change the key, or the old verdict (e.g. "document contradicts the
 * project's 50 MW") is replayed verbatim for a file whose bytes never changed.
 */
const base: ProjectProfile = {
  name: 'Torpus 5 MW Solar Plant',
  developer: 'SolarGen Zambia Ltd',
  technology: 'SOLAR_PV',
  capacityMW: 50,
  location: 'Central Province, Zambia',
};

const profileHash = (p: ProjectProfile) =>
  createHash('sha256').update(projectProfileKey(p)).digest('hex');

describe('projectProfileKey — profile edits invalidate cached extractions', () => {
  it('changes when the capacity changes', () => {
    expect(projectProfileKey({ ...base, capacityMW: 5 }))
      .not.toBe(projectProfileKey(base));
  });

  it('changes when the project name, developer or location changes', () => {
    expect(projectProfileKey({ ...base, name: 'Renamed Plant' })).not.toBe(projectProfileKey(base));
    expect(projectProfileKey({ ...base, developer: 'Other Ltd' })).not.toBe(projectProfileKey(base));
    expect(projectProfileKey({ ...base, location: 'Eastern Province, Zambia' })).not.toBe(projectProfileKey(base));
  });

  it('is stable for an unchanged profile', () => {
    expect(projectProfileKey({ ...base })).toBe(projectProfileKey({ ...base }));
  });

  it('distinguishes a null capacity from a zero one', () => {
    expect(projectProfileKey({ ...base, capacityMW: null }))
      .not.toBe(projectProfileKey({ ...base, capacityMW: 0 }));
  });

  it('produces a 64-char sha256 fingerprint', () => {
    expect(profileHash(base)).toHaveLength(64);
  });

  it('a capacity edit yields a different composite file+profile cache hash', () => {
    const fileHash = 'abc123';
    const before = `${fileHash}:${profileHash(base)}`;
    const after = `${fileHash}:${profileHash({ ...base, capacityMW: 5 })}`;
    expect(after).not.toBe(before);
  });
});
