'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { ActionToolbar, type ToolbarAction } from '@/components/ui/action-toolbar';
import { StatCard } from '@/components/ui/stat-card';
import {
  KpiBarSkeleton,
  TrackerTableSkeleton,
  AnalysisReportSkeleton,
  InspectorSkeleton,
} from '@/components/ui/skeleton';
import { HistoryDrawer } from '@/components/features/ai-overview/HistoryDrawer';
import { useRunAnalysis, useChatMessage } from '@/hooks/queries';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/api-client';

interface TrackedProject {
  name: string;
  sponsor: string;
  location: string;
  costUSD: number | null;
  capacityMW: number | null;
  category: string;
  constructionStart: string;
  commercialOperations: string;
  feasibilityReport: boolean;
  gridConnection: boolean;
  ppa: boolean;
  zemaApproval: boolean;
  secureLand: boolean;
  financialClose: boolean;
  erbPermit: boolean;
  epcCompleted: boolean;
  groundbreaking: boolean;
  bottlenecks: string[];
  comment?: string;
  riskScore: 'Low' | 'Medium' | 'High';
  aiSummary?: string;
  keyRisk?: string;
  nextAction?: string;
  timeToFinancialClose?: string;
}

interface AnalysisReport {
  macroSummary: string;
  portfolioScore: number;
  marketContext: {
    regionalOutlook: string;
    regulatoryClimate: string;
    financingConditions: string;
  };
  systemicRisks: { title: string; severity: string; rootCause: string; description: string; impact: string; solution: string }[];
  positiveHighlights: { title: string; impact: string; description: string }[];
  predictions: { horizon: string; prediction: string; confidence: string; basis: string }[];
  bottleneckAnalysis: {
    mostCommonBottleneck: string;
    affectedProjects: number;
    estimatedDelayMonths: number;
    industryBenchmark: string;
    resolutionStrategy: string;
  };
  capitalReadiness: {
    readyForFinancing: number;
    needsPreparation: number;
    criticalGaps: string[];
    recommendedFinancingStructure: string;
  };
  strategicRecommends: { priority: string; action: string; rationale: string; expectedOutcome: string }[];
}

export default function AIOverviewPage() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [projects, setProjects] = useState<TrackedProject[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const runAnalysisMutation = useRunAnalysis();
  const chatMutation = useChatMessage();
  const isAnalyzing = runAnalysisMutation.isPending;
  const isChatLoading = chatMutation.isPending;
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [cachedNotice, setCachedNotice] = useState<string | null>(null);
  const [currentFileHash, setCurrentFileHash] = useState<string | null>(null);
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<TrackedProject | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading_unused] = useState(false); // replaced by chatMutation.isPending
  const [parseError, setParseError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'risks' | 'predictions' | 'capital' | 'recommendations'>('risks');
  const [mobilePanel, setMobilePanel] = useState<'tracker' | 'analysis' | 'chat'>('tracker');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([
    {
      role: 'assistant',
      text: 'Hello Admin! I am Afri Connect AI Portfolio Agent. Upload your project Excel tracker, and I can answer deep portfolio questions, identify risk concentrations, or detail specific project challenges.',
    },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleLoadFromHistory = (record: any) => {
    if (!record.analysis_data) return;
    setAnalysisReport(record.analysis_data);
    setAnalysisId(record.id);
    setCurrentFileName(record.file_name);
    if (record.projects_snapshot?.length) setProjects(record.projects_snapshot);
    setCachedNotice(`Loaded from history: ${record.file_name} — analysed on ${new Date(record.created_at).toLocaleDateString()}`);
    setMobilePanel('analysis');
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParseError(null);
    setCachedNotice(null);
    setCurrentFileName(file.name);

    // Compute SHA-256 hash of the raw file for deduplication
    const computeHash = async (buffer: ArrayBuffer): Promise<string> => {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBuffer = event.target?.result as ArrayBuffer;
      const hash = await computeHash(rawBuffer);
      setCurrentFileHash(hash);
      try {
        const data = new Uint8Array(rawBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (rawRows.length < 2) throw new Error('Spreadsheet has insufficient rows.');

        const namePatternRe = /project\s*name|^name$|^project$|^title$/i;
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
          if (Array.isArray(rawRows[i]) && rawRows[i].some(
            cell => typeof cell === 'string' && namePatternRe.test(cell.trim())
          )) {
            headerIdx = i;
            break;
          }
        }
        if (headerIdx === -1) {
          headerIdx = rawRows.findIndex(r => Array.isArray(r) && r.some(c => c !== null && c !== undefined && c !== ''));
          if (headerIdx === -1) throw new Error('Could not find a header row in the spreadsheet.');
        }

        const headers = rawRows[headerIdx].map(h => String(h || '').trim());
        const dataRows = rawRows.slice(headerIdx + 1);
        const parsedProjects: TrackedProject[] = [];

        for (const row of dataRows) {
          if (!row || row.length === 0 || !row[0]) continue;

          const getVal = (patterns: string[]): string => {
            const idx = headers.findIndex(h =>
              patterns.some(pat => h.toLowerCase().includes(pat.toLowerCase()))
            );
            return idx !== -1 && row[idx] !== undefined ? String(row[idx]).trim() : '';
          };

          const name = getVal(['project name', 'name']);
          if (!name || name === 'undefined' || name.includes('Total')) continue;

          const sponsor = getVal(['project sponsor', 'sponsor']);
          const location = getVal(['project location', 'location', 'region', 'area']);
          const rawCost = getVal(['project cost', 'cost (usd)', 'cost']);
          const costUSD = rawCost ? parseFloat(rawCost.replace(/[^0-9.]/g, '')) : null;
          const rawCap = getVal(['plant capacity', 'capacity (mw)', 'capacity']);
          const capacityMW = rawCap ? parseFloat(rawCap.replace(/[^0-9.]/g, '')) : null;
          const category = getVal(['project category', 'category']) || (capacityMW && capacityMW >= 100 ? 'Large' : capacityMW && capacityMW >= 30 ? 'Medium' : 'Small');
          const constructionStart = getVal(['construction start']);
          const commercialOperations = getVal(['commercial operations', 'operations']);

          const checkComplete = (val: string) => {
            const l = val.toLowerCase();
            return l.includes('complete') || l === 'done' || l === 'yes' || l === 'competed';
          };

          const feasibilityReport = checkComplete(getVal(['feasilibility', 'feasibility']));
          const gridConnection = checkComplete(getVal(['grid connection']));
          const ppa = checkComplete(getVal(['ppa']));
          const zemaApproval = checkComplete(getVal(['zema approval', 'zema']));
          const secureLand = checkComplete(getVal(['secure land', 'local authority']));
          const financialClose = checkComplete(getVal(['financial close']));
          const erbPermit = checkComplete(getVal(['erb construction', 'erb permit', 'erb']));
          const epcCompleted = checkComplete(getVal(['epc contract', 'epc completed', 'epc']));
          const groundbreaking = checkComplete(getVal(['groundbreaking', 'ground breaking']));

          const bottlenecks: string[] = [];
          headers.forEach((h, index) => {
            if (h.toLowerCase().includes('bottleneck') || h.toLowerCase().includes('challenge')) {
              const bVal = row[index];
              if (bVal && String(bVal).trim() !== '' && String(bVal).trim().toLowerCase() !== 'none') {
                bottlenecks.push(String(bVal).trim());
              }
            }
          });

          const comment = getVal(['comment']);
          const completeCount = [feasibilityReport, gridConnection, ppa, zemaApproval, secureLand, financialClose, erbPermit, epcCompleted, groundbreaking].filter(Boolean).length;

          let riskScore: 'Low' | 'Medium' | 'High' = 'Medium';
          if (completeCount === 9) riskScore = 'Low';
          else if (completeCount >= 7) riskScore = bottlenecks.length > 0 ? 'Medium' : 'Low';
          else if (completeCount >= 4) riskScore = bottlenecks.length > 0 ? 'High' : 'Medium';
          else riskScore = 'High';

          let aiSummary = `${name} is a ${category.toLowerCase()}-scale energy asset sponsored by ${sponsor || 'Partners'}. `;
          if (bottlenecks.length > 0) aiSummary += `Currently facing: ${bottlenecks.join(', ')}. `;
          else if (groundbreaking) aiSummary += `Groundbreaking complete, targeting commercial operations ${commercialOperations || 'TBD'}. `;
          else aiSummary += `Completed ${completeCount}/9 development milestones. `;

          parsedProjects.push({
            name, sponsor, location, costUSD, capacityMW, category,
            constructionStart, commercialOperations, feasibilityReport,
            gridConnection, ppa, zemaApproval, secureLand, financialClose,
            erbPermit, epcCompleted, groundbreaking, bottlenecks, comment,
            riskScore, aiSummary,
          });
        }

        if (parsedProjects.length === 0) {
          throw new Error(
            `No valid project rows found. Headers detected: [${headers.filter(Boolean).join(', ')}]. ` +
            `Make sure your spreadsheet has a column named "Project Name" or "Name".`
          );
        }

        setProjects(parsedProjects);
        setAnalysisReport(null);
        setMobilePanel('tracker');
      } catch (err: any) {
        console.error('Failed to parse Excel file:', err);
        setParseError(err.message || 'Could not read Excel format.');
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRunAIAnalysis = async () => {
    if (projects.length === 0) return;
    try {
      const response: any = await runAnalysisMutation.mutateAsync({
        projects,
        fileHash: currentFileHash,
        fileName: currentFileName,
      });
      if (!response.success) throw new Error('Analysis returned no data.');
      const synthesis = response.data;
      if (response.cached) setCachedNotice(response.message);
      else setCachedNotice(null);
      setAnalysisId(response.analysisId ?? null);
      const enrichedProjects = projects.map((p: any) => {
        const ps = synthesis.projectSummaries?.[p.name] || synthesis.projectSummaries?.[p.name.trim()];
        return { ...p, aiSummary: ps?.summary || p.aiSummary, keyRisk: ps?.keyRisk, nextAction: ps?.nextAction, timeToFinancialClose: ps?.timeToFinancialClose };
      });
      setProjects(enrichedProjects);
      setAnalysisReport(synthesis);
      setMobilePanel('analysis');
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        text: response.cached
          ? `Loaded cached analysis for this file (score: ${synthesis.portfolioScore}/100). No new AI tokens were used.`
          : `Deep AI Portfolio Synthesis complete! Analysed ${projects.length} projects with live market data. Portfolio score: ${synthesis.portfolioScore}/100.`,
      }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: `Analysis failed: ${err.message || 'Unknown error'}.` }]);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const userText = chatInput;
    setChatHistory(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput('');
    try {
      const response: any = await chatMutation.mutateAsync({ projects, question: userText });
      setChatHistory(prev => [...prev, { role: 'assistant', text: (response as any).text || 'No response.' }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', text: `Error: ${err.message || 'Could not reach AI assistant.'}` }]);
    }
  };

  const handleDownloadReport = () => {
    if (!analysisReport) return;
    const lines: string[] = [];
    const date = new Date().toLocaleDateString();
    lines.push(`AFRI CONNECT — AI PORTFOLIO ANALYSIS REPORT`);
    lines.push(`Generated: ${date}  |  File: ${currentFileName || 'Unknown'}  |  Score: ${analysisReport.portfolioScore}/100`);
    lines.push('='.repeat(80));
    lines.push('');
    lines.push('EXECUTIVE SUMMARY');
    lines.push('-'.repeat(40));
    lines.push(analysisReport.macroSummary);
    lines.push('');
    if (analysisReport.marketContext) {
      lines.push('MARKET CONTEXT');
      lines.push('-'.repeat(40));
      lines.push(`Regional Outlook: ${analysisReport.marketContext.regionalOutlook}`);
      lines.push(`Regulatory Climate: ${analysisReport.marketContext.regulatoryClimate}`);
      lines.push(`Financing Conditions: ${analysisReport.marketContext.financingConditions}`);
      lines.push('');
    }
    if (analysisReport.systemicRisks?.length) {
      lines.push('SYSTEMIC RISKS');
      lines.push('-'.repeat(40));
      analysisReport.systemicRisks.forEach((r, i) => {
        lines.push(`${i + 1}. [${r.severity.toUpperCase()}] ${r.title}`);
        lines.push(`   Root Cause: ${r.rootCause}`);
        lines.push(`   Impact: ${r.impact}`);
        lines.push(`   Solution: ${r.solution}`);
        lines.push('');
      });
    }
    if (analysisReport.predictions?.length) {
      lines.push('PREDICTIONS');
      lines.push('-'.repeat(40));
      analysisReport.predictions.forEach(p => {
        lines.push(`[${p.horizon} — ${p.confidence} Confidence] ${p.prediction}`);
        lines.push(`  Basis: ${p.basis}`);
        lines.push('');
      });
    }
    if (analysisReport.capitalReadiness) {
      lines.push('CAPITAL READINESS');
      lines.push('-'.repeat(40));
      lines.push(`Ready for Financing: ${analysisReport.capitalReadiness.readyForFinancing} projects`);
      lines.push(`Needs Preparation: ${analysisReport.capitalReadiness.needsPreparation} projects`);
      lines.push(`Recommended Structure: ${analysisReport.capitalReadiness.recommendedFinancingStructure}`);
      lines.push(`Critical Gaps: ${analysisReport.capitalReadiness.criticalGaps?.join('; ')}`);
      lines.push('');
    }
    if (analysisReport.strategicRecommends?.length) {
      lines.push('STRATEGIC RECOMMENDATIONS');
      lines.push('-'.repeat(40));
      analysisReport.strategicRecommends.forEach((r: any, i: number) => {
        lines.push(`${i + 1}. [${r.priority}] ${r.action}`);
        lines.push(`   Rationale: ${r.rationale}`);
        lines.push(`   Expected Outcome: ${r.expectedOutcome}`);
        lines.push('');
      });
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-analysis-${(currentFileName || 'report').replace(/\.[^.]+$/, '')}-${date.replace(/\//g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCost = projects.reduce((acc, p) => acc + (p.costUSD || 0), 0);
  const totalCapacity = projects.reduce((acc, p) => acc + (p.capacityMW || 0), 0);
  const highRiskCount = projects.filter(p => p.riskScore === 'High').length;
  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sponsor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const scoreColor = (score: number) =>
    score >= 70 ? 'text-green-400' : score >= 45 ? 'text-yellow-400' : 'text-red-400';

  const priorityColor = (p: string) =>
    p === 'Immediate' ? 'bg-red-500/20 text-red-400' :
    p === 'Short-term' ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-blue-500/20 text-blue-400';

  const confidenceColor = (c: string) =>
    c === 'High' ? 'text-green-400' : c === 'Medium' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
      />

      <PageHeader
        icon={Icons.cpu}
        iconClassName="text-green-700 animate-pulse"
        title="AI Portfolio Oversight"
        description="Upload Excel trackers, map milestones, and run Gemini-powered deep analysis with live market data."
        actions={
          <>
            {(() => {
              const toolbarActions: ToolbarAction[] = [
                {
                  key: 'upload',
                  label: isParsing ? 'Parsing…' : 'Upload Tracker',
                  icon: Icons.download,
                  onClick: () => fileInputRef.current?.click(),
                  loading: isParsing,
                },
                {
                  key: 'report',
                  label: 'Download Report',
                  icon: Icons.fileText,
                  onClick: handleDownloadReport,
                  hidden: !analysisReport,
                },
                {
                  key: 'history',
                  label: 'History',
                  icon: Icons.database,
                  onClick: () => setHistoryOpen(true),
                },
              ];
              return <ActionToolbar actions={toolbarActions} />;
            })()}
            <Button
              onClick={projects.length > 0 ? handleRunAIAnalysis : () => fileInputRef.current?.click()}
              className="bg-green-800 hover:bg-green-700 text-white rounded-xl h-9 px-5 shadow-md shadow-green-900/20 text-sm font-semibold"
              disabled={isAnalyzing || isParsing}
            >
              {isAnalyzing
                ? <><Icons.spinner className="mr-2 size-4 animate-spin" />Analysing…</>
                : <><Icons.zap className="mr-2 size-4 text-amber-300" />{projects.length > 0 ? 'Run AI Analysis' : 'Get Started'}</>}
            </Button>
          </>
        }
      />

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoad={handleLoadFromHistory}
      />

      {/* Empty State */}
      {projects.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-10 sm:p-16 text-center space-y-5 max-w-2xl mx-auto shadow-sm">
          <div className="size-14 sm:size-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto text-green-800">
            <Icons.fileText className="size-7 sm:size-8 animate-bounce" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-bold text-slate-950">No Project Spreadsheet Uploaded</h3>
            <p className="text-slate-500 max-w-md mx-auto text-sm">
              Upload your Excel tracker (.xlsx, .csv) with columns: <span className="font-semibold text-slate-700">Project Name, Cost, Capacity, ZEMA Approval, PPA, Bottlenecks</span>.
            </p>
          </div>
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-left">
              <p className="text-xs font-bold text-red-700 mb-1">Parse Error</p>
              <p className="text-xs text-red-600">{parseError}</p>
            </div>
          )}
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-green-800 hover:bg-green-700 text-white rounded-xl h-10 px-6"
          >
            Select Spreadsheet File
          </Button>
        </div>
      ) : (
        <>
          {/* Cached / Loaded Notice */}
          {cachedNotice && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3">
              <Icons.info className="size-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 font-medium">{cachedNotice}</p>
              <button onClick={() => setCachedNotice(null)} className="ml-auto text-blue-400 hover:text-blue-700">
                <Icons.close className="size-3.5" />
              </button>
            </div>
          )}

          {/* KPI Bar */}
          {isParsing ? <KpiBarSkeleton /> : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Capital" value={totalCost > 0 ? `$${totalCost.toFixed(1)}M` : 'N/A'} />
              <StatCard label="Generation" value={totalCapacity > 0 ? `${totalCapacity.toLocaleString()} MW` : 'N/A'} valueClassName="text-green-700" />
              <StatCard label="High Risk" value={highRiskCount} valueClassName={highRiskCount > 0 ? 'text-red-600' : 'text-slate-900'} />
              <StatCard label="Pipeline" value={`${projects.length} Projects`} />
            </div>
          )}

          {/* Mobile Tab Nav */}
          <div className="flex lg:hidden border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
            {([
              { key: 'tracker', label: 'Tracker', icon: <Icons.folder className="size-3.5" /> },
              { key: 'analysis', label: 'Analysis', icon: <Icons.cpu className="size-3.5" /> },
              { key: 'chat', label: 'Chat', icon: <Icons.messageSquare className="size-3.5" /> },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setMobilePanel(tab.key)}
                className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${
                  mobilePanel === tab.key ? 'bg-green-800 text-white' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left: Tracker Table */}
            <div className={`lg:col-span-2 space-y-6 ${mobilePanel !== 'tracker' ? 'hidden lg:block' : ''}`}>

              {/* Analysis Report */}
              {isAnalyzing ? <AnalysisReportSkeleton /> : analysisReport && (
                <div className="bg-gradient-to-br from-green-900 to-slate-900 text-white rounded-3xl p-5 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 size-64 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Score + Summary */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="bg-green-500/20 p-2 rounded-xl text-green-400 shrink-0">
                        <Icons.zap className="size-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black tracking-tight">Gemini Investment Synthesis</h3>
                        <p className="text-[10px] text-green-300 uppercase tracking-widest">Live market data grounded</p>
                      </div>
                    </div>
                    {analysisReport.portfolioScore != null && (
                      <div className="text-center bg-white/10 rounded-xl px-5 py-3 shrink-0">
                        <span className={`text-3xl font-black ${scoreColor(analysisReport.portfolioScore)}`}>
                          {analysisReport.portfolioScore}
                        </span>
                        <span className="text-white/50 text-xs block">/ 100</span>
                        <span className="text-[9px] text-white/40 uppercase tracking-widest">Portfolio Score</span>
                      </div>
                    )}
                  </div>

                  <p className="text-green-50 text-sm leading-relaxed">{analysisReport.macroSummary}</p>

                  {/* Market Context */}
                  {analysisReport.marketContext && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-white/10 pt-5">
                      {[
                        { label: 'Regional Outlook', value: analysisReport.marketContext.regionalOutlook },
                        { label: 'Regulatory Climate', value: analysisReport.marketContext.regulatoryClimate },
                        { label: 'Financing Conditions', value: analysisReport.marketContext.financingConditions },
                      ].map((item, i) => (
                        <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-green-400 block">{item.label}</span>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="border-t border-white/10 pt-5 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {([
                        { key: 'risks', label: 'Risks', icon: <Icons.alertTriangle className="size-3" /> },
                        { key: 'predictions', label: 'Predictions', icon: <Icons.lineChart className="size-3" /> },
                        { key: 'capital', label: 'Capital', icon: <Icons.dollarSign className="size-3" /> },
                        { key: 'recommendations', label: 'Actions', icon: <Icons.checkCircle2 className="size-3" /> },
                      ] as const).map(tab => (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors ${
                            activeTab === tab.key ? 'bg-green-500/30 text-green-300 border border-green-500/30' : 'text-white/40 hover:text-white/70'
                          }`}
                        >
                          {tab.icon}{tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Risks Tab */}
                    {activeTab === 'risks' && (
                      <div className="space-y-3">
                        {analysisReport.systemicRisks?.map((risk, i) => (
                          <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-bold text-white">{risk.title}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                risk.severity === 'High' ? 'bg-red-500/20 text-red-400' :
                                risk.severity === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-green-500/20 text-green-400'
                              }`}>{risk.severity} Severity</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-[9px] uppercase tracking-widest text-red-400 font-bold block mb-1">Root Cause</span>
                                <p className="text-slate-300">{risk.rootCause}</p>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-widest text-yellow-400 font-bold block mb-1">Impact</span>
                                <p className="text-slate-300">{risk.impact}</p>
                              </div>
                              <div className="sm:col-span-2">
                                <span className="text-[9px] uppercase tracking-widest text-green-400 font-bold block mb-1">Solution</span>
                                <p className="text-slate-300">{risk.solution}</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Bottleneck Analysis */}
                        {analysisReport.bottleneckAnalysis && (
                          <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 block">Bottleneck Deep-Dive</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                              <div>
                                <span className="text-[9px] text-white/40 uppercase block">Most Common</span>
                                <span className="text-white font-bold">{analysisReport.bottleneckAnalysis.mostCommonBottleneck}</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-white/40 uppercase block">Affected</span>
                                <span className="text-white font-bold">{analysisReport.bottleneckAnalysis.affectedProjects} projects</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-white/40 uppercase block">Est. Delay</span>
                                <span className="text-red-400 font-bold">{analysisReport.bottleneckAnalysis.estimatedDelayMonths} months</span>
                              </div>
                              <div>
                                <span className="text-[9px] text-white/40 uppercase block">vs. Benchmark</span>
                                <span className="text-white font-bold text-[10px]">{analysisReport.bottleneckAnalysis.industryBenchmark}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-300 pt-1">{analysisReport.bottleneckAnalysis.resolutionStrategy}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Predictions Tab */}
                    {activeTab === 'predictions' && (
                      <div className="space-y-3">
                        {analysisReport.predictions?.map((pred, i) => (
                          <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">{pred.horizon}</span>
                              <span className={`text-[10px] font-bold ${confidenceColor(pred.confidence)}`}>
                                {pred.confidence} Confidence
                              </span>
                            </div>
                            <p className="text-sm text-white font-medium">{pred.prediction}</p>
                            <p className="text-xs text-slate-400">{pred.basis}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Capital Tab */}
                    {activeTab === 'capital' && analysisReport.capitalReadiness && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-green-500/10 rounded-xl p-4 text-center">
                            <span className="text-xl font-black text-green-400">{analysisReport.capitalReadiness.readyForFinancing}</span>
                            <span className="text-[10px] text-green-300 uppercase tracking-widest block mt-1">Ready for Financing</span>
                          </div>
                          <div className="bg-yellow-500/10 rounded-xl p-4 text-center">
                            <span className="text-xl font-black text-yellow-400">{analysisReport.capitalReadiness.needsPreparation}</span>
                            <span className="text-[10px] text-yellow-300 uppercase tracking-widest block mt-1">Needs Preparation</span>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-red-400 block">Critical Gaps</span>
                          <ul className="space-y-1">
                            {analysisReport.capitalReadiness.criticalGaps?.map((gap, i) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                                <Icons.alert className="size-3.5 text-red-400 shrink-0 mt-0.5" />
                                {gap}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-green-400 block mb-2">Recommended Structure</span>
                          <p className="text-xs text-slate-300">{analysisReport.capitalReadiness.recommendedFinancingStructure}</p>
                        </div>
                      </div>
                    )}

                    {/* Recommendations Tab */}
                    {activeTab === 'recommendations' && (
                      <div className="space-y-3">
                        {analysisReport.strategicRecommends?.map((rec: any, i: number) => (
                          <div key={i} className="bg-white/5 rounded-2xl p-4 border border-white/5 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${priorityColor(rec.priority)}`}>
                                {rec.priority}
                              </span>
                              <span className="text-sm font-bold text-white">{rec.action}</span>
                            </div>
                            <p className="text-xs text-slate-400">{rec.rationale}</p>
                            <div className="flex items-start gap-2 text-xs text-green-300">
                              <Icons.check className="size-3.5 shrink-0 mt-0.5" />
                              <span>{rec.expectedOutcome}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tracker Table */}
              {isParsing ? <TrackerTableSkeleton /> : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h3 className="font-bold text-slate-900">Project Compliance Tracker</h3>
                    <div className="relative w-full sm:w-64">
                      <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                      <Input
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-9 rounded-xl border-slate-200 text-sm"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                          <th className="px-4 sm:px-6 py-3">Project</th>
                          <th className="px-4 sm:px-6 py-3 text-center">Milestones</th>
                          <th className="px-4 sm:px-6 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProjects.map((p, idx) => {
                          const done = [p.feasibilityReport, p.gridConnection, p.ppa, p.zemaApproval, p.secureLand, p.financialClose, p.erbPermit, p.epcCompleted, p.groundbreaking].filter(Boolean).length;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 sm:px-6 py-3 space-y-0.5">
                                <span className="font-bold text-slate-950 block text-sm">{p.name}</span>
                                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                  {p.sponsor && <span className="font-medium text-slate-700">{p.sponsor}</span>}
                                  {p.location && <><span>•</span><span>{p.location}</span></>}
                                  {p.capacityMW && <span className="bg-green-50 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-bold">{p.capacityMW} MW</span>}
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-3">
                                <div className="flex flex-col items-center gap-1">
                                  <div className="flex gap-1">
                                    {[p.feasibilityReport, p.gridConnection, p.ppa, p.zemaApproval, p.secureLand, p.financialClose, p.erbPermit, p.epcCompleted, p.groundbreaking].map((v, i) => (
                                      <span key={i} className={`size-2 rounded-full ${v ? 'bg-green-600' : 'bg-slate-200'}`} />
                                    ))}
                                  </div>
                                  <span className="text-[10px] text-slate-400 font-bold">{done}/9</span>
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-3">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                    p.riskScore === 'Low' ? 'bg-green-50 text-green-700' :
                                    p.riskScore === 'Medium' ? 'bg-yellow-50 text-yellow-700' :
                                    'bg-red-50 text-red-700'
                                  }`}>{p.riskScore}</span>
                                  <Button
                                    onClick={() => {
                                      setSelectedProject(p);
                                      setMobilePanel('analysis');
                                      setTimeout(() => inspectorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
                                    }}
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-500 hover:text-green-800 text-xs font-bold h-7 px-2"
                                  >
                                    View
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Inspector + Chat */}
            <div ref={inspectorRef} className={`space-y-5 ${mobilePanel === 'tracker' ? 'hidden lg:block' : mobilePanel === 'chat' ? 'hidden lg:block' : ''}`}>

              {/* Project Inspector */}
              {isParsing ? <InspectorSkeleton /> : selectedProject ? (() => {
                const p = projects.find(x => x.name === selectedProject.name) || selectedProject;
                const done = [p.feasibilityReport, p.gridConnection, p.ppa, p.zemaApproval, p.secureLand, p.financialClose, p.erbPermit, p.epcCompleted, p.groundbreaking].filter(Boolean).length;
                const milestones = [
                  { label: 'Feasibility', done: p.feasibilityReport },
                  { label: 'Grid', done: p.gridConnection },
                  { label: 'PPA', done: p.ppa },
                  { label: 'ZEMA', done: p.zemaApproval },
                  { label: 'Land', done: p.secureLand },
                  { label: 'Fin Close', done: p.financialClose },
                  { label: 'ERB', done: p.erbPermit },
                  { label: 'EPC', done: p.epcCompleted },
                  { label: 'Groundbreak', done: p.groundbreaking },
                ];
                return (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-5 relative animate-in slide-in-from-right duration-300">
                    <button
                      onClick={() => setSelectedProject(null)}
                      className="absolute right-4 top-4 text-slate-400 hover:text-slate-950 p-1.5 hover:bg-slate-100 rounded-lg"
                    >
                      <Icons.close className="size-4" />
                    </button>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Project Details</span>
                      <h3 className="text-base font-black text-slate-900 leading-tight mt-0.5">{p.name}</h3>
                      {p.sponsor && <p className="text-xs text-slate-500">Sponsored by {p.sponsor}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-b border-slate-100 py-3">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Cost</span>
                        <span className="text-sm font-bold text-slate-900">{p.costUSD ? `$${p.costUSD}M` : 'Undisclosed'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Capacity</span>
                        <span className="text-sm font-bold text-green-700">{p.capacityMW ? `${p.capacityMW} MW` : 'Undisclosed'}</span>
                      </div>
                      {p.timeToFinancialClose && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Est. Time to Financial Close</span>
                          <span className="text-sm font-bold text-blue-700">{p.timeToFinancialClose}</span>
                        </div>
                      )}
                    </div>

                    {/* Milestone Grid */}
                    <div className="grid grid-cols-3 gap-1.5">
                      {milestones.map((m, i) => (
                        <div key={i} className={`rounded-xl px-2 py-1.5 text-center border ${m.done ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
                          <span className={`text-[9px] font-bold block ${m.done ? 'text-green-700' : 'text-slate-400'}`}>{m.label}</span>
                          <span className={`text-[10px] font-black ${m.done ? 'text-green-600' : 'text-slate-300'}`}>{m.done ? '✓' : '–'}</span>
                        </div>
                      ))}
                    </div>

                    {/* AI Summary */}
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-1.5">
                      <span className="text-[10px] font-bold text-green-800 uppercase tracking-widest flex items-center gap-1">
                        <Icons.cpu className="size-3" /> AI Summary
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed">{p.aiSummary}</p>
                    </div>

                    {/* Key Risk + Next Action */}
                    {(p.keyRisk || p.nextAction) && (
                      <div className="space-y-2">
                        {p.keyRisk && (
                          <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                            <span className="text-[9px] font-bold text-red-600 uppercase tracking-widest block mb-0.5">Key Risk</span>
                            <p className="text-xs text-red-800 font-medium">{p.keyRisk}</p>
                          </div>
                        )}
                        {p.nextAction && (
                          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                            <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block mb-0.5">Next Action</span>
                            <p className="text-xs text-blue-800 font-medium">{p.nextAction}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottlenecks */}
                    {p.bottlenecks.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Challenges</span>
                        <ul className="space-y-1.5">
                          {p.bottlenecks.map((b, i) => (
                            <li key={i} className="bg-red-50/50 text-red-900 border border-red-100/50 text-xs px-3 py-2 rounded-xl font-bold flex gap-2 items-start">
                              <Icons.alert className="size-3.5 text-red-600 shrink-0 mt-0.5" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center space-y-3">
                  <Icons.info className="size-8 text-slate-300 mx-auto" />
                  <div>
                    <h4 className="font-bold text-slate-950 text-sm">No Project Selected</h4>
                    <p className="text-xs text-slate-500 mt-1">Click "View" on any row to inspect project details and AI summaries.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Panel — full width on mobile when chat tab active */}
            <div className={`lg:col-span-1 ${mobilePanel !== 'chat' ? 'hidden lg:block' : ''}`}>
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[480px] lg:h-[500px]">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                  <Icons.cpu className="size-5 text-green-800" />
                  <span className="font-bold text-sm text-slate-900">Portfolio Assistant</span>
                  <span className="bg-green-100 text-green-800 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ml-auto">Gemini + Search</span>
                </div>
                <div className="flex-grow p-4 overflow-y-auto space-y-3 text-xs">
                  {chatHistory.map((chat, i) => (
                    <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`p-3 rounded-2xl max-w-[88%] leading-relaxed text-xs ${
                        chat.role === 'user'
                          ? 'bg-green-800 text-white rounded-tr-none font-medium'
                          : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200/50'
                      }`}>
                        {chat.text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl rounded-tl-none p-3 border border-slate-200/50 flex items-center gap-2">
                        <Icons.spinner className="size-3 animate-spin text-slate-400" />
                        <span className="text-xs text-slate-400">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex gap-2 bg-slate-50">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about the portfolio..."
                    className="bg-white rounded-xl text-xs h-9 border-slate-200 flex-grow"
                    disabled={isChatLoading}
                  />
                  <Button type="submit" size="icon" className="bg-green-800 hover:bg-green-700 size-9 rounded-xl shrink-0 text-white" disabled={isChatLoading}>
                    <Icons.send className="size-4" />
                  </Button>
                </form>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
