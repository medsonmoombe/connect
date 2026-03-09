'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { projectService } from '@/services/projects';
import { Project, CapitalMatchResult, TechnicalMatchResult } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons, ArrowLeft, Download, ShieldCheck, Zap, MapPin, DollarSign, FileText, Check, MoreVertical, Send } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { MatchingSection } from '@/components/MatchingSection';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(1);
  const [capitalMatches, setCapitalMatches] = useState<CapitalMatchResult[]>([]);
  const [technicalMatches, setTechnicalMatches] = useState<TechnicalMatchResult[]>([]);

  useEffect(() => {
    async function fetchProject() {
      if (params.id) {
        try {
          const data = await projectService.getProjectDetails(params.id as string);
          setProject(data);
          // Set stage based on project_stage enum if needed, for now just 1
          setActiveStage(data.project_stage === 'FEASIBILITY' ? 1 : data.project_stage === 'PRE_CONSTRUCTION' ? 2 : 3);
          
          // Fetch matches
          const matches = await projectService.getProjectMatches(params.id as string);
          setCapitalMatches(matches.capital);
          setTechnicalMatches(matches.technical);
        } catch (error) {
          console.error('Error fetching project:', error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchProject();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Icons.spinner className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-6 text-center">
        <h1 className="text-2xl font-bold text-text-main mb-4">Project Not Found</h1>
        <Link href="/dashboard/developer">
          <Button>Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto no-scrollbar">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-gray-100 h-16 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm font-bold text-text-muted uppercase tracking-widest">
            <Link href="/dashboard/developer" className="hover:text-primary transition-colors flex items-center gap-2">
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
            <Icons.chevronRight className="size-3" />
            <span className="text-text-main">{project.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-10 px-6 rounded-xl border-gray-200 font-bold text-text-main">Share</Button>
            <Button className="h-10 px-6 bg-primary text-primary-content hover:bg-primary/90 font-bold rounded-xl shadow-lg transition-all">
              Request Review
            </Button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="p-10 rounded-[40px] bg-surface border border-gray-100 shadow-soft mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-[200px] -z-10"></div>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-100 mb-6">
                  <Check className="size-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {project.scores?.capital_readiness_score && project.scores.capital_readiness_score > 70 ? 'Institutional Grade' : 'Internal Portfolio'}
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-text-main leading-tight mb-6">
                  {project.name}
                </h1>
                <div className="flex flex-wrap items-center gap-8 text-sm font-bold text-text-muted uppercase tracking-wider">
                  <span className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl"><Zap className="size-4 text-primary" /> {project.project_size_mw} MW</span>
                  <span className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl"><MapPin className="size-4 text-primary" /> {project.location_country}</span>
                  <span className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl"><DollarSign className="size-4 text-primary" /> ${(project.capital_required / 1000000).toFixed(1)}M Capital</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center p-6 bg-white border border-gray-100 rounded-3xl shadow-soft min-w-[140px]">
                <div className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Readiness</div>
                <div className="text-4xl font-black text-primary">{project.scores?.capital_readiness_score || 0}%</div>
                <div className="w-full bg-gray-100 h-1 rounded-full mt-4 overflow-hidden">
                   <div className="bg-primary h-full" style={{ width: `${project.scores?.capital_readiness_score || 0}%` }}></div>
                </div>
              </div>
            </div>

            {/* Workflow Stepper */}
            <div className="relative pt-12 pb-4">
              <div className="absolute top-[4.25rem] left-0 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-700" 
                  style={{ width: `${(activeStage - 1) * 25}%` }} 
                />
              </div>
              <div className="relative flex justify-between">
                <StepItem number={1} label="Feasibility" status={activeStage > 1 ? "completed" : activeStage === 1 ? "active" : "pending"} />
                <StepItem number={2} label="Permitting" status={activeStage > 2 ? "completed" : activeStage === 2 ? "active" : "pending"} />
                <StepItem number={3} label="Financial Close" status={activeStage > 3 ? "completed" : activeStage === 3 ? "active" : "pending"} />
                <StepItem number={4} label="Construction" status={activeStage > 4 ? "completed" : activeStage === 4 ? "active" : "pending"} />
                <StepItem number={5} label="Operations" status={activeStage === 5 ? "active" : "pending"} />
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Project Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* Technical Overview */}
              <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                <h3 className="text-xl font-bold text-text-main mb-8 flex items-center gap-3">
                  <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                    <Zap className="size-4" />
                  </div>
                  Technical Specifications
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
                  <SpecItem label="Technology" value={project.technology_type || 'N/A'} />
                  <SpecItem label="Grid Connection" value={project.tech_requirements?.grid_status || 'Pending'} />
                  <SpecItem label="Land Status" value="In Progress" />
                  <SpecItem label="Offtake" value="N/A" />
                  <SpecItem label="Expected COD" value="TBD" />
                  <SpecItem label="Stage" value={project.project_stage} />
                </div>
              </div>

              {/* AI Scoring Analysis */}
              {project.scores && (
                <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                  <h3 className="text-xl font-bold text-text-main mb-8 flex items-center gap-3">
                    <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Icons.zap className="size-4" />
                    </div>
                    AI Readiness Insights
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-8 mb-10">
                    <div className="space-y-6">
                      <ScoreMetric label="Financial Transparency" score={project.scores.financial_transparency_score} />
                      <ScoreMetric label="Governance Clarity" score={project.scores.governance_score} />
                      <ScoreMetric label="Documentation Quality" score={project.scores.documentation_score} />
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <h4 className="text-xs font-black text-text-muted uppercase tracking-widest mb-4">AI Executive Summary</h4>
                      <p className="text-sm text-text-main leading-relaxed italic">
                        "{project.scores.summary || "No summary available."}"
                      </p>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-error uppercase tracking-widest flex items-center gap-2">
                        <Icons.shieldCheck className="size-3" />
                        Risk Flags
                      </h4>
                      <ul className="space-y-2">
                        {project.scores.risk_flags?.map((flag, i) => (
                          <li key={i} className="text-xs font-bold text-text-main flex items-start gap-2 bg-error/5 p-3 rounded-xl border border-error/10">
                            <span className="size-1.5 rounded-full bg-error mt-1.5 shrink-0" />
                            {flag}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-2">
                        <Icons.zap className="size-3" />
                        Strategic Recommendations
                      </h4>
                      <ul className="space-y-2">
                        {project.scores.recommendations?.map((rec, i) => (
                          <li key={i} className="text-xs font-bold text-text-main flex items-start gap-2 bg-primary/5 p-3 rounded-xl border border-primary/10">
                            <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Room / Documents */}
              <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-text-main flex items-center gap-3">
                    <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <ShieldCheck className="size-4" />
                    </div>
                    Secure Data Room
                  </h3>
                  <Button variant="outline" className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest rounded-xl border-gray-200">
                    <Download className="size-3 mr-2" /> Download All
                  </Button>
                </div>
                <div className="grid gap-4">
                  {project.documents && project.documents.length > 0 ? (
                    project.documents.map((doc, i) => (
                      <DocumentItem key={i} name={doc.document_type} size="N/A" date={new Date(doc.uploaded_at).toLocaleDateString()} />
                    ))
                  ) : (
                    <div className="p-10 text-center border border-dashed border-gray-200 rounded-2xl">
                      <p className="text-sm font-bold text-text-muted uppercase tracking-widest">No documents uploaded yet</p>
                      <Button variant="ghost" className="mt-4 text-primary font-bold text-xs uppercase tracking-widest">
                        Upload First Document
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Engagement Sidebar */}
            <div className="space-y-8">
              {/* Analytics Summary */}
              <div className="p-8 rounded-[32px] bg-slate-900 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-[100px]"></div>
                <h3 className="text-lg font-bold mb-6">Market Interest</h3>
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Views</span>
                      <span className="text-lg font-bold">124</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Data Room Access</span>
                      <span className="text-lg font-bold text-primary">8</span>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">NDA Requests</span>
                      <span className="text-lg font-bold">3</span>
                   </div>
                </div>
                <Button className="w-full h-12 rounded-xl bg-primary text-primary-content font-bold mt-8 hover:scale-105 transition-all">
                  View Detailed Analytics
                </Button>
              </div>

              {/* Discussion Preview */}
              <div className="rounded-[32px] bg-surface border border-gray-100 shadow-soft overflow-hidden flex flex-col h-[400px]">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">Active Discussions</h3>
                    <p className="text-[10px] font-bold text-text-muted mt-1 uppercase">3 Ongoing Threads</p>
                  </div>
                  <Icons.messageSquare className="size-5 text-primary" />
                </div>
                
                <div className="flex-grow p-6 overflow-y-auto no-scrollbar space-y-6">
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                     <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">GC</div>
                     <div>
                        <p className="text-xs font-bold text-text-main mb-1">GreenGrowth Capital</p>
                        <p className="text-[10px] text-text-muted leading-relaxed font-medium">"Could you provide more detail on the grid connection timeline?"</p>
                     </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                     <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[10px]">NP</div>
                     <div>
                        <p className="text-xs font-bold text-text-main mb-1">Nordic Power Fund</p>
                        <p className="text-[10px] text-text-muted leading-relaxed font-medium">"NDA countersigned. Awaiting access to financial model."</p>
                     </div>
                  </div>
                </div>

                <div className="p-6 border-t border-gray-50">
                  <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5">
                    Open Engagement Center
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <MatchingSection 
            projectId={project.id} 
            capitalMatches={capitalMatches} 
            technicalMatches={technicalMatches} 
          />
        </div>
      </main>
    </div>
  );
}

function StepItem({ number, label, status }: { number: number, label: string, status: 'completed' | 'active' | 'pending' }) {
  return (
    <div className="flex flex-col items-center gap-3 z-10">
      <div className={cn(
        "size-10 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-500 shadow-lg",
        status === 'completed' && "bg-primary border-primary text-primary-content",
        status === 'active' && "bg-white border-primary text-primary ring-4 ring-primary/10 scale-110",
        status === 'pending' && "bg-white border-gray-200 text-text-muted"
      )}>
        {status === 'completed' ? <Check className="size-5" /> : number}
      </div>
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-widest text-center max-w-[80px]",
        status === 'pending' ? "text-text-muted" : "text-text-main"
      )}>
        {label}
      </span>
    </div>
  );
}

function DocumentItem({ name, size, date }: { name: string, size: string, date: string }) {
  return (
    <div className="flex items-center justify-between p-5 rounded-[20px] bg-background border border-gray-50 hover:border-primary/30 group transition-all cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
          <FileText className="size-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{name}</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1.5">{size} • {date}</p>
        </div>
      </div>
      <MoreVertical className="size-4 text-text-muted hover:text-text-main" />
    </div>
  );
}

function SpecItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className="text-sm font-bold text-text-main">{value}</p>
    </div>
  );
}

function ScoreMetric({ label, score }: { label: string, score: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-text-main uppercase tracking-widest">{label}</span>
        <span className="text-sm font-black text-primary">{score}%</span>
      </div>
      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-1000 ease-out" 
          style={{ width: `${score}%` }} 
        />
      </div>
    </div>
  );
}
