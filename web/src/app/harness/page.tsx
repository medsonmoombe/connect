'use client';

/**
 * TEMPORARY diagnostic harness (not part of the product).
 *
 * Reproduces the developer-portal shell (`DashboardShell`) plus the Step-1
 * "Latest Regulatory Approvals" block of /developer/submit — with the real
 * ApprovalCard / ProofUploadSlot / StepWizardHeader components and the exact
 * wrapper class strings used by the real page — and writes layout
 * measurements into a fixed-position overlay so they can be read with
 * `chrome --headless --dump-dom`.
 *
 * Delete this folder once the investigation is done.
 */

import { useEffect, useRef, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/Shell';
import { ApprovalCard } from '@/components/ui/form/ApprovalCard';
import { ProofUploadSlot } from '@/components/ui/form/ProofUploadSlot';
import { StepWizardHeader } from '@/components/ui/form/StepWizardHeader';
import { FormSection } from '@/components/ui/form/FormSection';
import { FieldLabel } from '@/components/ui/form/FieldLabel';
import { Icons } from '@/components/ui/icons';
import { REGULATORY_APPROVALS, APPROVAL_PROOF_TYPES } from '@/lib/project-validation';

function measure(label: string): string {
  const main = document.querySelector('main') as HTMLElement;
  const se = document.scrollingElement as HTMLElement;
  const scrollArea = document.getElementById('scroll-area') as HTMLElement;
  const mainTop = main.getBoundingClientRect().top;
  const contentBottom = Math.round(
    scrollArea.getBoundingClientRect().bottom - mainTop + main.scrollTop,
  );
  main.scrollTop = 1e9;
  se.scrollTop = 1e9;
  const bodyCS = getComputedStyle(document.body);
  const mainCS = getComputedStyle(main);
  return [
    `[${label}]`,
    `win=${window.innerWidth}x${window.innerHeight}`,
    `html: scrollH=${document.documentElement.scrollHeight} clientH=${document.documentElement.clientHeight} scrollTopMax=${se.scrollTop}`,
    `body: scrollH=${document.body.scrollHeight} clientH=${document.body.clientHeight} overflow=${bodyCS.overflow} height=${bodyCS.height}`,
    `main: clientH=${main.clientHeight} scrollH=${main.scrollHeight} scrollTopMax=${main.scrollTop} padBottom=${mainCS.paddingBottom}`,
    `contentBottom=${contentBottom} deadSpaceBelowContent=${main.scrollHeight - contentBottom}`,
    `cardsAreaH=${Math.round((document.getElementById('cards-area') as HTMLElement).getBoundingClientRect().height)}`,
  ].join(' | ');
}

export default function HarnessPage() {
  const [ticked, setTicked] = useState<string[]>([]);
  const [report, setReport] = useState('running…');
  const reportRef = useRef('');

  useEffect(() => {
    const reports: string[] = [];
    const push = (label: string) => {
      reports.push(measure(label));
      reportRef.current = reports.join('\n');
      setReport(reportRef.current);
    };

    const t1 = setTimeout(() => {
      push('closed');
      const boxes = Array.from(document.querySelectorAll('input[type=checkbox]')) as HTMLInputElement[];
      boxes.forEach((b) => b.click());
    }, 700);

    const t2 = setTimeout(() => push('open'), 1800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
}