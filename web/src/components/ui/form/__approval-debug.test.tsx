import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApprovalCard } from './ApprovalCard';
import { ProofUploadSlot } from './ProofUploadSlot';
import { FieldLabel } from './FieldLabel';
import { FormSection } from './FormSection';
import { StepWizardHeader } from './StepWizardHeader';
import { YesNoField } from '../YesNoField';
import { InfoHint } from '../InfoHint';

vi.mock('@/lib/upload-constants', () => ({
  ALLOWED_EXTENSIONS: '.pdf,.png',
}));

describe('debug: approval components render in every state', () => {
  it('ApprovalCard renders in all post-click states', () => {
    const states = [
      { checked: false, badge: 'not-held' as const, children: undefined },
      {
        checked: true,
        badge: 'proof-required' as const,
        children: (
          <ProofUploadSlot label="Proof — Permit" onSelect={() => {}} error="Required" />
        ),
      },
      {
        checked: true,
        badge: 'proof-attached' as const,
        children: (
          <ProofUploadSlot
            label="Proof — Permit"
            file={{ file: {} as File, type: 'x' }}
            onSelect={() => {}}
          />
        ),
      },
      {
        checked: true,
        badge: 'proof-required' as const,
        uploading: true,
        uploadProgress: 42,
        children: (
          <ProofUploadSlot label="Proof — Permit" existingName="permit.pdf" onSelect={() => {}} onRemove={() => {}} />
        ),
      },
    ];
    for (const s of states) {
      const html = renderToStaticMarkup(
        <ApprovalCard
          checked={s.checked}
          title="Construction Permit"
          index="04"
          badge={s.badge}
          error={s.checked ? 'Proof required' : undefined}
          uploading={s.uploading}
          uploadProgress={s.uploadProgress}
          onCheckChange={() => {}}
        >
          {s.children}
        </ApprovalCard>
      );
      expect(html.length).toBeGreaterThan(0);
    }
  });

  it('step-1 sibling components render without crashing', () => {
    const html = renderToStaticMarkup(
      <>
        <FieldLabel label="Latest Regulatory Approvals" required hint="Tick the approvals you hold." />
        <FormSection number="01" title="Opportunity details" note={`2 questions`} />
        <StepWizardHeader
          step={1}
          totalSteps={5}
          steps={[{ label: 'Identity' }, { label: 'Scale' }]}
          icon={<span>i</span>}
          title="Project Identity"
          subtitle="Provide basic details."
          saveState="off"
        />
        <YesNoField label="Have you secured the land?" value={true} onChange={() => {}} required description="Attach proof if Yes." />
        <InfoHint text="Helper" />
      </>
    );
    expect(html.length).toBeGreaterThan(0);
  });
});