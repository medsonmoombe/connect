import { describe, expect, it } from 'vitest';
import {
  SAFE_EDIT_FIELDS,
  MATERIAL_FIELDS,
  MATERIAL_TECH_FIELDS,
  SYSTEM_FIELDS,
  FIELD_LOCK_STATUSES,
  isFieldLockedWhileLive,
  isMaterialField,
  partitionEditablePayload,
  partitionTechPayload,
  MATERIAL_FIELDS_LOCKED_MESSAGE,
} from '../project-edit-policy';

describe('field tier definitions', () => {
  it('has no overlap between tiers', () => {
    const all = [...SAFE_EDIT_FIELDS, ...MATERIAL_FIELDS, ...MATERIAL_TECH_FIELDS, ...SYSTEM_FIELDS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('treats target dates and narrative fields as safe', () => {
    expect(SAFE_EDIT_FIELDS).toContain('description');
    expect(SAFE_EDIT_FIELDS).toContain('target_cod');
    expect(SAFE_EDIT_FIELDS).toContain('target_financial_close_date');
  });

  it('treats deal-shape fields as material', () => {
    for (const f of ['project_size_mw', 'capital_required', 'technology_type', 'location_country']) {
      expect(MATERIAL_FIELDS).toContain(f);
      expect(isMaterialField(f)).toBe(true);
    }
  });

  it('treats system fields as never developer-editable', () => {
    expect(SYSTEM_FIELDS).toContain('project_stage');
    expect(SYSTEM_FIELDS).toContain('rejection_reason');
    for (const f of SYSTEM_FIELDS) expect(isMaterialField(f)).toBe(false);
  });
});

describe('isFieldLockedWhileLive', () => {
  it('locks live and under_review', () => {
    expect(isFieldLockedWhileLive('live')).toBe(true);
    expect(isFieldLockedWhileLive('under_review')).toBe(true);
  });

  it('does not lock other statuses or empty values', () => {
    for (const s of ['draft', 'scoring', 'paused', 'archived', null, undefined, '']) {
      expect(isFieldLockedWhileLive(s)).toBe(false);
    }
  });

  it('matches FIELD_LOCK_STATUSES exactly', () => {
    for (const s of FIELD_LOCK_STATUSES) expect(isFieldLockedWhileLive(s)).toBe(true);
  });
});

describe('partitionEditablePayload', () => {
  const current = {
    name: 'Kafue Solar',
    project_size_mw: 50,
    capital_required: 60_000_000,
    description: 'old description',
  };

  it('passes safe fields through unchanged', () => {
    const { accepted, blockedFields } = partitionEditablePayload(
      { description: 'new description' },
      current,
      false,
    );
    expect(blockedFields).toEqual([]);
    expect(accepted).toEqual({ description: 'new description' });
  });

  it('blocks material fields whose value actually changed', () => {
    const { accepted, blockedFields } = partitionEditablePayload(
      { project_size_mw: 80, description: 'ok' },
      current,
      false,
    );
    expect(blockedFields).toEqual(['project_size_mw']);
    expect(accepted).toEqual({ description: 'ok' });
  });

  it('allows material fields that round-trip unchanged (wizard full-form save)', () => {
    const { accepted, blockedFields } = partitionEditablePayload(
      { project_size_mw: 50, capital_required: 60_000_000, description: 'edited' },
      current,
      false,
    );
    expect(blockedFields).toEqual([]);
    expect(accepted.description).toBe('edited');
  });

  it('coerces numeric string vs number comparisons', () => {
    const { blockedFields } = partitionEditablePayload(
      { project_size_mw: '50' },
      current,
      false,
    );
    expect(blockedFields).toEqual([]);
  });

  it('counts a material field as changed when no current row exists', () => {
    const { blockedFields } = partitionEditablePayload({ name: 'x' }, null, false);
    expect(blockedFields).toEqual(['name']);
  });

  it('bypasses the lock entirely for platform admins', () => {
    const payload = { project_size_mw: 80, name: 'renamed' };
    const { accepted, blockedFields } = partitionEditablePayload(payload, current, true);
    expect(blockedFields).toEqual([]);
    expect(accepted).toEqual(payload);
  });

  it('ignores unknown fields (neither blocked nor stripped)', () => {
    const { accepted, blockedFields } = partitionEditablePayload(
      { some_future_field: 1 } as Record<string, unknown>,
      current,
      false,
    );
    expect(blockedFields).toEqual([]);
    expect(accepted.some_future_field).toBe(1);
  });
});

describe('partitionTechPayload', () => {
  const currentTech = { grid_status: 'on_grid', ppa_status: 'unsigned', required_services: ['a'] };

  it('blocks changed material tech fields', () => {
    const { accepted, blockedFields } = partitionTechPayload(
      { grid_status: 'off_grid', ppa_status: 'unsigned' },
      currentTech,
      false,
    );
    expect(blockedFields).toEqual(['grid_status']);
    expect(accepted).toEqual({ ppa_status: 'unsigned' });
  });

  it('allows unchanged tech fields through', () => {
    const { blockedFields } = partitionTechPayload(
      { grid_status: 'on_grid', required_services: ['a'] },
      currentTech,
      false,
    );
    expect(blockedFields).toEqual([]);
  });

  it('bypasses for platform admins', () => {
    const payload = { grid_status: 'off_grid' };
    const { accepted, blockedFields } = partitionTechPayload(payload, currentTech, true);
    expect(blockedFields).toEqual([]);
    expect(accepted).toEqual(payload);
  });
});

describe('MATERIAL_FIELDS_LOCKED_MESSAGE', () => {
  it('has a {fields} placeholder for interpolation', () => {
    expect(MATERIAL_FIELDS_LOCKED_MESSAGE).toContain('{fields}');
  });
});
