import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md border border-slate-200 bg-white px-8 py-10 text-center shadow-[0_12px_32px_-8px_rgba(22,36,28,0.18)]">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-amber-100 bg-amber-50">
          <Icons.search className="size-6 text-amber-500" />
        </div>

        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
          404 &mdash; Not found
        </p>
        <h1 className="mb-2 text-lg font-bold tracking-tight text-slate-900">
          This page doesn&apos;t exist
        </h1>
        <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-slate-500">
          The link may be outdated or the address mistyped. Head back to your dashboard,
          or use the sidebar navigation to find what you need.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button icon={<Icons.layoutDashboard className="size-3.5" />}>
              Go to dashboard
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
