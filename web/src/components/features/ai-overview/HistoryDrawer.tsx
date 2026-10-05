'use client';

import { useState } from 'react';
import { useAnalysisHistory } from '@/hooks/queries';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { apiClient } from '@/lib/api-client';
import { Drawer } from '@/components/ui/drawer';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { HistoryTableSkeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';

interface AnalysisRecord {
  id: string;
  file_name: string;
  project_count: number;
  portfolio_score: number | null;
  status: 'pending' | 'complete' | 'failed';
  estimated_tokens: number | null;
  created_at: string;
  performed_by: string;
}

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onLoad: (record: any) => void;
}

const scoreColor = (s: number) =>
  s >= 70 ? 'text-green-700' : s >= 45 ? 'text-yellow-600' : 'text-red-600';

const statusVariant = (s: AnalysisRecord['status']) =>
  s === 'complete' ? 'green' : s === 'pending' ? 'yellow' : ('red' as const);

export function HistoryDrawer({ open, onClose, onLoad }: HistoryDrawerProps) {
  const qc = useQueryClient();
  const { data: records = [], isLoading: loading } = useAnalysisHistory() as { data: AnalysisRecord[]; isLoading: boolean };
  const [actionId, setActionId] = useState<string | null>(null);

  const handleLoad = async (id: string) => {
    setActionId(id);
    try {
      const res: any = await apiClient.post('/admin/ai-analysis', { action: 'get', analysisId: id });
      if (res.success) {
        qc.setQueryData(queryKeys.aiAnalysis.detail(id), res.data);
        onLoad(res.data);
        onClose();
      }
    } catch (e) { console.error(e); }
    finally { setActionId(null); }
  };

  const handleExportJSON = async (id: string, fileName: string) => {
    setActionId(id);
    try {
      const res: any = await apiClient.post('/admin/ai-analysis', { action: 'get', analysisId: id });
      if (res.success) {
        const blob = new Blob([JSON.stringify(res.data.analysis_data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis-${fileName.replace(/\.[^.]+$/, '')}-${new Date(res.data.created_at).toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally { setActionId(null); }
  };

  const safeRecords = records ?? [];
  const totalTokens = safeRecords.reduce((s, r) => s + (r.estimated_tokens || 0), 0);
  const completedCount = safeRecords.filter(r => r.status === 'complete').length;
  const failedCount = safeRecords.filter(r => r.status === 'failed').length;

  const columns: Column<AnalysisRecord>[] = [
    {
      key: 'file',
      header: 'File',
      render: r => (
        <div className="flex items-center gap-2">
          <Icons.fileText className="size-4 text-slate-400 shrink-0" />
          <span className="text-sm font-medium text-slate-900 truncate max-w-[160px]">{r.file_name}</span>
        </div>
      ),
    },
    {
      key: 'projects',
      header: 'Projects',
      className: 'text-center',
      render: r => <span className="text-sm font-bold text-slate-700">{r.project_count}</span>,
    },
    {
      key: 'score',
      header: 'Score',
      className: 'text-center',
      render: r => r.portfolio_score != null
        ? <span className={`text-sm font-black ${scoreColor(r.portfolio_score)}`}>{r.portfolio_score}/100</span>
        : <span className="text-slate-300">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: r => <Badge variant={statusVariant(r.status)}>{r.status}</Badge>,
    },
    {
      key: 'date',
      header: 'Date',
      render: r => (
        <div className="text-xs text-slate-600">
          <span className="font-medium block">{new Date(r.created_at).toLocaleDateString()}</span>
          <span className="text-slate-400">{new Date(r.created_at).toLocaleTimeString()}</span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: r => r.status !== 'complete' ? null : (
        <div className="flex items-center gap-1">
          <Button
            onClick={() => handleLoad(r.id)}
            disabled={actionId === r.id}
            variant="ghost"
            size="sm"
            className="text-green-700 hover:bg-green-50 text-xs h-7 px-2"
          >
            {actionId === r.id
              ? <Icons.spinner className="size-3 animate-spin" />
              : <Icons.arrowRight className="size-3 mr-1" />}
            Load
          </Button>
          <Button
            onClick={() => handleExportJSON(r.id, r.file_name)}
            disabled={actionId === r.id}
            variant="ghost"
            size="sm"
            className="text-slate-500 hover:text-slate-900 text-xs h-7 px-2"
          >
            <Icons.download className="size-3 mr-1" />
            JSON
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Analysis History"
      description="All AI portfolio analyses. Load any record back into the workspace."
      size="xl"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" value={safeRecords.length} />
          <StatCard label="Completed" value={completedCount} valueClassName="text-green-700" />
          <StatCard label="Est. Tokens" value={totalTokens.toLocaleString()} />
          <StatCard label="Failed" value={failedCount} valueClassName={failedCount > 0 ? 'text-red-600' : 'text-slate-900'} />
        </div>

        <div className="bg-white rounded-none border border-slate-200 shadow-sm overflow-hidden">
          {loading ? <HistoryTableSkeleton /> : (
            <DataTable
              columns={columns}
              data={safeRecords}
              rowKey={r => r.id}
              emptyTitle="No analyses yet"
              emptyDescription="Run your first analysis from the AI Overview page."
            />
          )}
        </div>
      </div>
    </Drawer>
  );
}
