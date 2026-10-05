'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  CartesianGrid, Cell,
} from 'recharts';
import { KitTooltip, CHART_MARGIN } from '@/components/charts/ChartKit';
import { GRID_PROPS, AXIS_PROPS, BAR_RADIUS } from '@/lib/chart-theme';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHero } from '@/components/ui/PageHero';
import PageTitle from '@/components/PageTitle';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProviderConfig {
  id: number;
  active_provider: string;
  active_model: string;
  prompt_version: number;
  confidence_threshold: number;
  max_chars_per_doc: number;
  platform_monthly_budget_usd: number;
  updated_by: string | null;
  updated_at: string;
}

interface CatalogRow {
  provider: string;
  model: string;
  label: string;
  input_per_1m: number;
  output_per_1m: number;
  supports_vision: boolean;
  enabled: boolean;
}

interface MonthlyRow {
  month: string;
  provider: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

interface TopProject {
  project_id: string;
  requests: number;
  cost_usd: number;
  projects?: { name: string } | null;
}

// ── Shared card primitives (matches admin/page.tsx) ───────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent = false,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3">{label}</span>
        <span className="grid size-8 place-items-center rounded-none bg-brand-soft text-brand-text">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="px-4 pb-4 pt-1">
        <p className={`text-2xl font-bold tracking-tight ${accent ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className={`text-[11px] font-semibold mt-0.5 ${accent ? 'text-red-500' : 'text-slate-400'}`}>{sub}</p>}
      </div>
    </div>
  );
}

function SectionCard({ title, label, action, children }: {
  title: string; label?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-none border border-line bg-white shadow-[0_1px_2px_rgba(22,36,28,0.05)]">
      <div className="flex flex-wrap items-center gap-3.5 border-b border-line bg-white px-[22px] py-[17px]">
        <div>
          {label && <p className="text-[10.5px] font-extrabold uppercase tracking-[0.13em] text-ink-3 mb-0.5">{label}</p>}
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// (Chart tooltip now comes from components/charts/ChartKit)

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[88px] w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#0b3b24',
  mistral: '#3b82f6',
  deepseek: '#f59e0b',
};

function providerDisplayName(id: string) {
  return { gemini: 'Gemini', mistral: 'Mistral', deepseek: 'DeepSeek' }[id] ?? id;
}

function buildSpendChartData(monthly: MonthlyRow[]) {
  // Group by month, sum across providers
  const byMonth: Record<string, Record<string, number>> = {};
  for (const row of monthly) {
    const m = new Date(row.month).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    if (!byMonth[m]) byMonth[m] = {};
    byMonth[m][row.provider] = (byMonth[m][row.provider] ?? 0) + Number(row.cost_usd);
  }
  return Object.entries(byMonth)
    .reverse()
    .map(([month, providers]) => ({ month, ...providers }));
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminAIProviderPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [catalog, setCatalog] = useState<CatalogRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [topProjects, setTopProjects] = useState<TopProject[]>([]);
  const [budgetUsd, setBudgetUsd] = useState(0);
  const [spentThisMonth, setSpentThisMonth] = useState(0);

  // Form state
  const [provider, setProvider] = useState('gemini');
  const [model, setModel] = useState('');
  const [budget, setBudget] = useState('');
  const [threshold, setThreshold] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, usageRes] = await Promise.all([
        fetch('/api/admin/ai/config?all=true'),
        fetch('/api/admin/ai/usage?months=6'),
      ]);
      const cfg = await cfgRes.json();
      const usage = await usageRes.json();

      if (cfg.success && cfg.data?.config) {
        const c = cfg.data.config as ProviderConfig;
        setConfig(c);
        setProvider(c.active_provider);
        setModel(c.active_model);
        setBudget(String(c.platform_monthly_budget_usd));
        setThreshold(String(c.confidence_threshold));
      }
      // Keep all catalog rows (enabled + disabled) so the model dropdown is
    // never empty when switching providers.
    setCatalog((cfg.data?.catalog ?? []) as CatalogRow[]);

      if (usage.success && usage.data) {
        setMonthly(usage.data.monthly ?? []);
        setTopProjects(usage.data.topProjects ?? []);
        setBudgetUsd(Number(usage.data.budgetUsd ?? 0));
        setSpentThisMonth(Number(usage.data.spentThisMonthUsd ?? 0));
      }
    } catch {
      toast.error('Failed to load AI provider configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Show all models for the selected provider (enabled ones first).
  const modelsForProvider = catalog
    .filter((m) => m.provider === provider)
    .sort((a, b) => Number(b.enabled) - Number(a.enabled));

  const handleProviderChange = (p: string) => {
    setProvider(p);
    // Prefer first enabled model, fall back to any model for that provider
    const first = catalog.find((m) => m.provider === p && m.enabled)
      ?? catalog.find((m) => m.provider === p);
    setModel(first?.model ?? '');
  };

  const handleSave = async () => {
    if (!model) { toast.error('Select a model for the active provider'); return; }
    const budgetNum = parseFloat(budget);
    if (Number.isNaN(budgetNum) || budgetNum < 0) { toast.error('Enter a valid monthly budget'); return; }
    const thresholdNum = parseFloat(threshold);
    if (Number.isNaN(thresholdNum) || thresholdNum < 0.5 || thresholdNum > 0.95) {
      toast.error('Confidence threshold must be between 0.50 and 0.95');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active_provider: provider,
          active_model: model,
          platform_monthly_budget_usd: budgetNum,
          confidence_threshold: thresholdNum,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        toast.success(`Switched to ${providerDisplayName(provider)} / ${model}`);
        await fetchAll();
      } else {
        toast.error(d.error?.message ?? 'Failed to save AI provider config');
      }
    } catch {
      toast.error('Failed to save AI provider config');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  const overBudget = spentThisMonth >= budgetUsd && budgetUsd > 0;
  const budgetPct = budgetUsd > 0 ? Math.min((spentThisMonth / budgetUsd) * 100, 100) : 0;
  const spendChartData = buildSpendChartData(monthly);
  const activeProviders = [...new Set(monthly.map((r) => r.provider))];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageTitle title="AI Provider" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <PageHero
        eyebrow="System"
        title="AI Provider"
        description="Manage the active AI provider, model, budget, and confidence threshold for all scoring runs."
        actions={
          <Button
            variant="outline"
            className="h-9 px-4 bg-white/10 border-white/15 text-white hover:bg-white/20"
            onClick={fetchAll}
            icon={<Icons.refreshCw />}
          >
            Refresh
          </Button>
        }
      />

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Active Provider"
          value={providerDisplayName(provider)}
          sub={model || '—'}
          icon={Icons.cpu}
        />
        <KpiCard
          label="Spent This Month"
          value={`$${spentThisMonth.toFixed(2)}`}
          sub={`of $${budgetUsd.toFixed(2)} budget`}
          icon={Icons.dollarSign}
          accent={overBudget}
        />
        <KpiCard
          label="Monthly Budget"
          value={`$${budgetUsd.toFixed(2)}`}
          sub={overBudget ? 'Exhausted — AI calls blocked' : `${(100 - budgetPct).toFixed(0)}% remaining`}
          icon={Icons.shieldCheck}
          accent={overBudget}
        />
        <KpiCard
          label="Confidence Threshold"
          value={config ? `${(config.confidence_threshold * 100).toFixed(0)}%` : '—'}
          sub="Min. to count as verified"
          icon={Icons.zap}
        />
      </div>

      {/* ── Row 1: Config form + Spend chart ───────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Provider config form */}
        <SectionCard title="Provider Switch" label="Configuration">
          <div className="p-5 space-y-4">

            {overBudget && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-red-50 border border-red-200 text-red-700 text-[12px] font-semibold">
                <Icons.alertTriangle className="size-4 shrink-0" />
                Budget exhausted — the orchestrator is refusing AI calls this month.
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Provider</Label>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value)}
                className="w-full h-10 px-3 rounded border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] transition-colors appearance-none cursor-pointer"
              >
                {['gemini', 'mistral', 'deepseek'].map((p) => (
                  <option key={p} value={p}>{providerDisplayName(p)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Model</Label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full h-10 px-3 rounded border border-slate-200 text-sm bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#0b3b24]/10 focus:border-[#0b3b24] transition-colors appearance-none cursor-pointer"
              >
                {modelsForProvider.length === 0 && <option value="">No models in catalog for this provider</option>}
                {modelsForProvider.map((m) => (
                  <option key={m.model} value={m.model}>
                    {m.label}{m.supports_vision ? ' · vision' : ''}{!m.enabled ? ' (disabled)' : ''} — ${m.input_per_1m}/1M in · ${m.output_per_1m}/1M out
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Monthly Budget (USD)</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="h-10 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confidence Threshold</Label>
                <Input
                  type="number"
                  min={0.5}
                  max={0.95}
                  step="0.01"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="h-10 border-slate-200"
                />
              </div>
            </div>

            {/* Budget progress bar */}
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                <span>Budget Used</span>
                <span className={overBudget ? 'text-red-500' : ''}>{budgetPct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-gradient-to-r from-[#0b3b24] to-green-500'}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              {overBudget ? <Badge variant="red">Over Budget</Badge> : <span />}
              <Button
                className="h-9 px-5 font-bold"
                onClick={handleSave}
                disabled={saving}
                icon={saving ? <Icons.spinner className="animate-spin" /> : <Icons.check />}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Monthly spend chart */}
        <div className="lg:col-span-2">
          <SectionCard title="Monthly Spend by Provider" label="6-Month Cost Trend">
            <div className="p-5">
              {spendChartData.length === 0 ? (
                <div className="h-52 flex items-center justify-center text-[13px] text-slate-400 font-medium">
                  No AI usage recorded yet.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={spendChartData} margin={CHART_MARGIN}>
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="month" {...AXIS_PROPS} />
                      <YAxis {...AXIS_PROPS} tickFormatter={(v) => `$${v}`} width={44} />
                      <KitTooltip formatter={(v) => `$${Number(v).toFixed(4)}`} />
                      {activeProviders.map((p) => (
                        <Bar key={p} dataKey={p} name={providerDisplayName(p)} stackId="a" radius={BAR_RADIUS} fill={PROVIDER_COLORS[p] ?? '#94a3b8'} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center gap-5 mt-3 px-1">
                    {activeProviders.map((p) => (
                      <span key={p} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                        <span className="size-2 rounded-full" style={{ background: PROVIDER_COLORS[p] ?? '#94a3b8' }} />
                        {providerDisplayName(p)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ── Row 2: Model catalog + Top projects ────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Model catalog */}
        <div className="lg:col-span-2">
          <SectionCard title="Model Catalog" label="Enabled Models">
            <div className="divide-y divide-slate-50">
              {catalog.filter((m) => m.enabled).length === 0 ? (
                <p className="p-5 text-[13px] text-slate-400">No enabled models in catalog.</p>
              ) : (
                catalog.filter((m) => m.enabled).map((m) => {
                  const isActive = m.provider === config?.active_provider && m.model === config?.active_model;
                  return (
                    <div key={`${m.provider}-${m.model}`} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{ background: PROVIDER_COLORS[m.provider] ?? '#94a3b8' }}
                        />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{m.label}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {providerDisplayName(m.provider)} · ${m.input_per_1m}/1M in · ${m.output_per_1m}/1M out
                            {m.supports_vision ? ' · vision' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isActive && (
                          <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#0b3b24] text-white uppercase tracking-widest">
                            Active
                          </span>
                        )}
                        <button
                          onClick={() => { handleProviderChange(m.provider); setModel(m.model); }}
                          className="text-[11px] font-bold text-slate-400 hover:text-[#0b3b24] transition-colors uppercase tracking-widest"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </SectionCard>
        </div>

        {/* Top projects by cost */}
        <SectionCard title="Top Projects by Cost" label="This Month">
          <div className="divide-y divide-slate-50">
            {topProjects.length === 0 ? (
              <p className="p-5 text-[13px] text-slate-400">No AI usage recorded yet this month.</p>
            ) : (
              topProjects.map((p, i) => (
                <div key={p.project_id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[10px] font-black text-slate-300 w-4 shrink-0">#{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-slate-900 truncate">
                        {p.projects?.name ?? 'Untitled project'}
                      </p>
                      <p className="text-[10px] text-slate-400">{p.requests} request(s)</p>
                    </div>
                  </div>
                  <span className="text-[12px] font-black text-slate-900 shrink-0">${Number(p.cost_usd).toFixed(4)}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      {/* ── Row 3: Raw usage breakdown ─────────────────────────── */}
      <SectionCard title="Usage Breakdown" label="By Provider · Last 6 Months">
        {monthly.length === 0 ? (
          <p className="p-5 text-[13px] text-slate-400">No usage data yet.</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {monthly.slice(0, 12).map((row) => {
              const maxCost = Math.max(...monthly.map((r) => Number(r.cost_usd)), 0.0001);
              return (
                <div key={`${row.month}-${row.provider}`} className="px-5 py-3.5 hover:bg-slate-50/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ background: PROVIDER_COLORS[row.provider] ?? '#94a3b8' }}
                      />
                      <span className="text-[12px] font-bold text-slate-700">
                        {new Date(row.month).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                        {' · '}{providerDisplayName(row.provider)}
                      </span>
                    </div>
                    <span className="text-[12px] font-black text-slate-900">${Number(row.cost_usd).toFixed(4)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((Number(row.cost_usd) / maxCost) * 100, 100)}%`,
                        background: PROVIDER_COLORS[row.provider] ?? '#94a3b8',
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {row.requests} req · {Number(row.input_tokens).toLocaleString()} in / {Number(row.output_tokens).toLocaleString()} out tokens
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

    </div>
  );
}
