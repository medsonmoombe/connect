import { useState } from 'react';
import { Icons } from './icons';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey: (row: T) => string;
  pageSize?: number;
  actions?: (row: T) => React.ReactNode;
  skeletonRows?: number;
}

function SkeletonCell({ className }: { className?: string }) {
  return <div className={cn('h-4 bg-slate-200 animate-pulse', className)} />;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyTitle = 'No records found',
  emptyDescription,
  rowKey,
  pageSize = 5,
  actions,
  skeletonRows = 6,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(data.length / pageSize);
  const start = page * pageSize;
  const pageData = data.slice(start, start + pageSize);

  // Reset to page 0 when data shrinks below current page
  if (page > 0 && start >= data.length) {
    setPage(0);
  }

  if (loading) {
    return (
      <div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-2 text-ink-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] border-b border-line">
                {columns.map(col => (
                  <th key={col.key} className={cn('px-4 py-3', col.className)}>
                    {col.header}
                  </th>
                ))}
                {actions && <th className="px-4 py-3 w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map(col => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      <SkeletonCell className={col.key === 'status' || col.key === 'stage' ? 'w-24' : col.key === 'capital' ? 'w-20 ml-auto' : 'w-40'} />
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3"><SkeletonCell className="w-6 ml-auto" /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-8 px-6 text-center space-y-1">
        <Icons.database className="size-6 text-slate-200 mx-auto" />
        <p className="text-xs font-bold text-slate-400">{emptyTitle}</p>
        {emptyDescription && <p className="text-[11px] text-slate-400">{emptyDescription}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-2 text-ink-3 text-[10.5px] font-extrabold uppercase tracking-[0.1em] border-b border-line">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                  {col.header}
                </th>
              ))}
              {actions && <th className="px-4 py-3 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageData.map(row => (
              <tr key={rowKey(row)} className="hover:bg-slate-50/50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
                {actions && <td className="px-4 py-3 text-right">{actions(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400 font-medium">
            {start + 1}–{Math.min(start + pageSize, data.length)} of {data.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 rounded-none text-xs font-semibold"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              <Icons.arrowLeft className="size-3.5 mr-1" />
              Prev
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`size-8 rounded-none text-xs font-bold transition-colors ${
                  i === page
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 rounded-none text-xs font-semibold"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next
              <Icons.arrowRight className="size-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
