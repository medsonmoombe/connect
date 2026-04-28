'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { projectService } from '@/services/projects';
import { Project, CapitalMatchResult, TechnicalMatchResult, ProjectDocument, ProjectStage } from '@/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Icons, ArrowLeft, Download, ShieldCheck, Zap, MapPin, DollarSign, FileText, Check, MoreVertical, Send, Trash2 } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { MatchingSection } from '@/components/MatchingSection';
import { storage, functions } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/hooks/useAuth';
import { engagementService } from '@/lib/engagement';
import { auditLogsApi } from '@/services/api';

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(1);
  const [capitalMatches, setCapitalMatches] = useState<CapitalMatchResult[]>([]);
  const [technicalMatches, setTechnicalMatches] = useState<TechnicalMatchResult[]>([]);
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const [hasNda, setHasNda] = useState(false);

  useEffect(() => {
    async function checkPermissions() {
      if (project && user) {
        const owner = project.developer_id === user.company_id || user.role === 'ADMIN';
        setIsOwner(owner);

        if (!owner && user.company_id) {
          const engagements = await engagementService.getCompanyEngagements(user.company_id);
          const projectEng = engagements.find(e => e.project_id === project.id);
          if (projectEng) {
            setIsPartner(true);
            setHasNda(projectEng.status !== 'INTRO_SENT' && projectEng.status !== 'INTRO_ACCEPTED');
          }
        }
      }
    }
    checkPermissions();
  }, [project, user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !project) return;

    setUploading(true);
    try {
      const storageRef = ref(storage!, `projects/${project.id}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      const newDoc = await projectService.addProjectDocument({
        project_id: project.id,
        document_type: file.name,
        file_url: url
      });

      setProject({
        ...project,
        documents: [...(project.documents || []), newDoc]
      });
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      // Delete from Storage
      const storageRef = ref(storage!, fileUrl);
      await deleteObject(storageRef);

      // Delete from DB
      await projectService.deleteProjectDocument(docId);

      setProject({
        ...project!,
        documents: project!.documents?.filter(d => d.id !== docId)
      });
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete document');
    }
  };

  const runAIAnalysis = async () => {
    if (!project || !project.documents || project.documents.length === 0) {
      alert('Please upload documents first');
      return;
    }

    setAnalyzing(true);
    try {
      console.log('Starting AI Analysis for project:', project.id);
      const scoreProject = httpsCallable(functions!, 'scoreProject');
      
      const documentPaths = project.documents
        .map(d => {
          try {
            const url = new URL(d.file_url);
            const pathPart = url.pathname.split('/o/')[1];
            return pathPart ? decodeURIComponent(pathPart.split('?')[0]) : null;
          } catch (e) {
            console.warn('Failed to parse document URL:', d.file_url);
            return null;
          }
        })
        .filter((p): p is string => p !== null);

      console.log('Sending document paths to AI:', documentPaths);

      if (documentPaths.length === 0) {
        throw new Error('No valid document paths found. Ensure documents are uploaded to Firebase Storage.');
      }

      const projectId = project.id;
      if (!projectId) {
        throw new Error('Project ID is missing from the current state.');
      }

      const payload = { projectId, documentPaths };
      console.log('Final Cloud Function Payload:', JSON.stringify(payload, null, 2));

      const result = await scoreProject(payload);
      console.log('Raw Cloud Function Result:', result.data);

      const responseData = result.data as any;
      if (!responseData.success || !responseData.data) {
        throw new Error('AI failed to generate a valid scoring result.');
      }

      const scoringData = responseData.data;
      console.log('Extracted Scoring Data:', scoringData);

      // Validate structure before saving
      if (!scoringData.breakdown) {
        console.error('Missing breakdown in AI response:', scoringData);
        throw new Error('AI response is missing the detailed scoring breakdown.');
      }

      // Extract scores with defaults to prevent crashes and ensure they are integers for Supabase
      const regulatory = Math.round(scoringData.breakdown.regulatory?.score ?? 0);
      const financial = Math.round(scoringData.breakdown.financial?.score ?? 0);
      const developer = Math.round(scoringData.breakdown.developer?.score ?? 0);
      const totalScore = Math.round(scoringData.total_score ?? (regulatory + financial + developer));

      // Update in DB
      const updatedScores = await projectService.saveProjectScores({
        project_id: project.id,
        capital_readiness_score: totalScore,
        regulatory_score: regulatory,
        financial_score: financial,
        developer_score: developer,
        breakdown: scoringData.breakdown,
        risk_flags: (scoringData.risk_signals || []).map((s: any) => `${s.level}: ${s.text}`),
        recommendations: scoringData.recommendations || [],
        summary: scoringData.summary || 'Analysis complete.'
      });

      setProject({
        ...project,
        scores: updatedScores
      });

      // Trigger matching refresh
      await projectService.runMatchingEngine(project.id);
      const matches = await projectService.getProjectMatches(project.id);
      setCapitalMatches(matches.capital);
      setTechnicalMatches(matches.technical);

    } catch (error) {
      console.error('AI Analysis error:', error);
      alert('Failed to run AI analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleManualOverride = async (category: string, score: number) => {
    if (!project || !project.scores) return;

    const newScores: any = { ...project.scores };
    if (category === 'regulatory') newScores.regulatory_score = score;
    if (category === 'financial') newScores.financial_score = score;
    if (category === 'developer') newScores.developer_score = score;

    // Recalculate total
    newScores.capital_readiness_score = Math.round(
      (newScores.regulatory_score || 0) + 
      (newScores.financial_score || 0) + 
      (newScores.developer_score || 0)
    );

    try {
      const updated = await projectService.saveProjectScores(newScores);
      setProject({ ...project, scores: updated });
    } catch (error) {
      console.error('Override error:', error);
    }
  };

  const [editingChecklist, setEditingChecklist] = useState(false);
  const [checklistData, setChecklistData] = useState<{
    has_secured_land: boolean;
    land_title_status: 'Traditional' | 'Titled' | 'Not Applicable';
    has_reached_financial_close: boolean;
    regulatory_approvals: string[];
  }>({
    has_secured_land: false,
    land_title_status: 'Not Applicable',
    has_reached_financial_close: false,
    regulatory_approvals: []
  });

  useEffect(() => {
    if (project) {
      // Try to parse checklist data from risk_disclosures if it looks like JSON
      let checklistFromRisk: any = {};
      try {
        if (project.risk_disclosures?.startsWith('{')) {
          checklistFromRisk = JSON.parse(project.risk_disclosures);
        }
      } catch (e) {
        console.warn('Failed to parse checklist from risk_disclosures');
      }

      setChecklistData({
        has_secured_land: checklistFromRisk.has_secured_land ?? project.has_secured_land ?? false,
        land_title_status: checklistFromRisk.land_title_status ?? (project.land_title_status as any) ?? 'Not Applicable',
        has_reached_financial_close: checklistFromRisk.has_reached_financial_close ?? project.has_reached_financial_close ?? false,
        regulatory_approvals: checklistFromRisk.regulatory_approvals ?? project.regulatory_approvals ?? []
      });
    }
  }, [project]);

  const handleUpdateChecklist = async () => {
    if (!project) return;
    try {
      console.log('Updating project with checklist data...');
      
      // Since columns might not exist, we'll store the checklist as a JSON string in risk_disclosures
      const checklistJson = JSON.stringify(checklistData);
      
      const updatePayload: any = {
        risk_disclosures: checklistJson
      };

      // Also try to update the individual columns in case they DO exist (graceful degradation)
      // If they don't exist, Supabase might throw an error, so we might need to be careful.
      // Given the previous error, they likely don't exist.
      
      await projectService.updateProject(project.id, updatePayload);
      
      setProject({ 
        ...project, 
        ...checklistData,
        risk_disclosures: checklistJson 
      });
      setEditingChecklist(false);
    } catch (error: any) {
      console.error('Error updating checklist detail:', error);
      alert(`Failed to update checklist: ${error.message || 'Database column mismatch. Storing in risk_disclosures failed.'}`);
    }
  };

  useEffect(() => {
    async function fetchProject() {
      if (params.id) {
        try {
          const data = await projectService.getProjectDetails(params.id as string);
          setProject(data);
          // Set stage based on project_stage enum
          const stages: ProjectStage[] = ['CONCEPT', 'FEASIBILITY', 'PRE_CONSTRUCTION', 'READY_TO_BUILD', 'UNDER_CONSTRUCTION', 'OPERATIONAL'];
          const stageIndex = stages.indexOf(data.project_stage as any);
          setActiveStage(stageIndex !== -1 ? stageIndex + 1 : 1);
          
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

  useEffect(() => {
    async function logView() {
      if (project && user && project.developer_id !== user.company_id && user.role !== 'ADMIN') {
        try {
          await auditLogsApi.create({
            user_id: user.id,
            action_type: 'PROJECT_VIEW',
            entity_type: 'PROJECT',
            entity_id: project.id
          });
        } catch (error) {
          console.error('Error logging project view:', error);
        }
      }
    }
    logView();
  }, [project, user]);

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
          {isOwner && (
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="h-10 px-6 rounded-xl border-gray-200 font-bold text-text-main"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied to clipboard!');
                }}
              >
                Share
              </Button>
              <Button className="h-10 px-6 bg-primary text-primary-content hover:bg-primary/90 font-bold rounded-xl shadow-lg transition-all">
                Request Review
              </Button>
            </div>
          )}
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
                  style={{ width: `${(activeStage - 1) * 20}%` }} 
                />
              </div>
              <div className="relative flex justify-between">
                <StepItem number={1} label="Concept" status={activeStage > 1 ? "completed" : activeStage === 1 ? "active" : "pending"} />
                <StepItem number={2} label="Feasibility" status={activeStage > 2 ? "completed" : activeStage === 2 ? "active" : "pending"} />
                <StepItem number={3} label="Permitting" status={activeStage > 3 ? "completed" : activeStage === 3 ? "active" : "pending"} />
                <StepItem number={4} label="Financial Close" status={activeStage > 4 ? "completed" : activeStage === 4 ? "active" : "pending"} />
                <StepItem number={5} label="Construction" status={activeStage > 5 ? "completed" : activeStage === 5 ? "active" : "pending"} />
                <StepItem number={6} label="Operations" status={activeStage === 6 ? "active" : "pending"} />
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
          <SpecItem label="Land Status" value={project.has_secured_land ? "Secured" : "In Progress"} />
          <SpecItem label="Offtake" value="N/A" />
          <SpecItem label="Expected Go-Live" value={project.target_cod || "TBD"} />
          <SpecItem label="Stage" value={project.project_stage} />
        </div>
      </div>

      {/* Checklist View (New) */}
      <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-text-main flex items-center gap-3">
            <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Check className="size-4" />
            </div>
            Readiness Checklist
          </h3>
          {isOwner && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary font-bold"
              onClick={() => editingChecklist ? handleUpdateChecklist() : setEditingChecklist(true)}
            >
              {editingChecklist ? "Save Selection" : "Edit Selection"}
            </Button>
          )}
        </div>

        {editingChecklist ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={checklistData.has_secured_land}
                  onChange={(e) => setChecklistData({ ...checklistData, has_secured_land: e.target.checked })}
                  className="size-5 rounded border-gray-300 text-primary"
                />
                <Label className="text-sm font-bold text-text-main">Have you secured the land?</Label>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Land Title Status</Label>
                <select 
                  className="w-full h-11 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none"
                  value={checklistData.land_title_status}
                  onChange={(e) => setChecklistData({ ...checklistData, land_title_status: e.target.value as any })}
                >
                  <option value="Traditional">Traditional</option>
                  <option value="Titled">Titled</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={checklistData.has_reached_financial_close}
                  onChange={(e) => setChecklistData({ ...checklistData, has_reached_financial_close: e.target.checked })}
                  className="size-5 rounded border-gray-300 text-primary"
                />
                <Label className="text-sm font-bold text-text-main">Have you reached financial close?</Label>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Latest Regulatory Approvals</Label>
                <div className="grid grid-cols-1 gap-2">
                  {['ZEMA approval letter', 'Grid Connection Agreement', 'Power Purchase Agreement (PPA)', 'Construction Permit'].map((approval) => (
                    <div key={approval} className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={checklistData.regulatory_approvals.includes(approval)}
                        onChange={(e) => {
                          const approvals = e.target.checked 
                            ? [...checklistData.regulatory_approvals, approval]
                            : checklistData.regulatory_approvals.filter(a => a !== approval);
                          setChecklistData({ ...checklistData, regulatory_approvals: approvals });
                        }}
                        className="size-4 rounded border-gray-300 text-primary"
                      />
                      <Label className="text-xs font-medium text-text-muted">{approval}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            <ChecklistItem label="Land Secured" checked={project.has_secured_land || false} />
            <ChecklistItem label="Financial Close Reached" checked={project.has_reached_financial_close || false} />
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Land Title Status</p>
              <p className="text-sm font-bold text-text-main">{project.land_title_status || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Regulatory Approvals</p>
              <div className="flex flex-wrap gap-2">
                {project.regulatory_approvals && project.regulatory_approvals.length > 0 ? project.regulatory_approvals.map((a: string) => (
                  <span key={a} className="px-2 py-1 bg-primary/5 text-primary text-[10px] font-bold rounded-lg border border-primary/10">{a}</span>
                )) : <span className="text-sm font-bold text-text-muted italic">None stated</span>}
              </div>
            </div>
          </div>
        )}
      </div>

              {/* AI Scoring Analysis */}
              <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-text-main flex items-center gap-3">
                    <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <Icons.zap className="size-4" />
                    </div>
                    AI Readiness Insights
                  </h3>
                  {(isOwner || user?.role === 'ADMIN') && project.scores && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-9 px-4 rounded-xl border-gray-200"
                        onClick={() => setShowOverride(!showOverride)}
                      >
                        {showOverride ? 'Close Override' : 'Manual Override'}
                      </Button>
                      <Button 
                        size="sm" 
                        className="h-9 px-4 bg-primary text-white rounded-xl shadow-lg"
                        onClick={runAIAnalysis}
                        disabled={analyzing}
                      >
                        {analyzing ? <Icons.spinner className="size-3 animate-spin mr-2" /> : <Icons.zap className="size-3 mr-2" />}
                        Re-run AI Analysis
                      </Button>
                    </div>
                  )}
                </div>
                
                {project.scores ? (
                  <>
                    {showOverride && (
                      <div className="mb-10 p-6 bg-slate-50 rounded-3xl border border-slate-200 animate-in fade-in slide-in-from-top-4">
                        <h4 className="text-sm font-bold text-text-main mb-4">Manual Score Adjustment</h4>
                        <div className="grid md:grid-cols-3 gap-6">
                          <OverrideSlider label="Regulatory" value={project.scores.regulatory_score || 0} max={40} onChange={(v) => handleManualOverride('regulatory', v)} />
                          <OverrideSlider label="Financial" value={project.scores.financial_score || 0} max={35} onChange={(v) => handleManualOverride('financial', v)} />
                          <OverrideSlider label="Developer" value={project.scores.developer_score || 0} max={25} onChange={(v) => handleManualOverride('developer', v)} />
                        </div>
                      </div>
                    )}
                    
                    <div className="grid md:grid-cols-3 gap-6 mb-10">
                      <ScorePillar 
                        label="Regulatory" 
                        score={project.scores.regulatory_score || 0} 
                        max={40} 
                        color="bg-blue-600"
                        details={project.scores.breakdown?.regulatory?.details}
                      />
                      <ScorePillar 
                        label="Financial" 
                        score={project.scores.financial_score || 0} 
                        max={35} 
                        color="bg-green-600"
                        details={project.scores.breakdown?.financial?.details}
                      />
                      <ScorePillar 
                        label="Developer" 
                        score={project.scores.developer_score || 0} 
                        max={25} 
                        color="bg-amber-600"
                        details={project.scores.breakdown?.developer?.details}
                      />
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 mb-10">
                      <h4 className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Icons.zap className="size-3 text-primary" />
                        Strategic Executive Summary
                      </h4>
                      <p className="text-sm text-text-main leading-relaxed font-medium italic">
                        "{project.scores.summary || "Project analysis in progress. Our AI is evaluating the documentation stack for institutional alignment."}"
                      </p>
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
                  </>
                ) : (
                  <div className="p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                    <div className="size-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-primary shadow-sm">
                      <Icons.zap className="size-8" />
                    </div>
                    <h4 className="text-xl font-black text-text-main mb-2">No Analysis Found</h4>
                    <p className="text-sm text-text-muted max-w-sm mx-auto mb-8 font-medium">
                      Upload your feasibility studies and technical specs to the Data Room, then run the AI Scrutiny engine to generate institutional readiness scores.
                    </p>
                    <Button 
                      onClick={runAIAnalysis}
                      disabled={analyzing || !project.documents || project.documents.length === 0}
                      className="h-14 px-10 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                    >
                      {analyzing ? <Icons.spinner className="size-5 animate-spin mr-2" /> : <Icons.zap className="size-5 mr-2" />}
                      Start AI Scrutiny
                    </Button>
                    {!project.documents || project.documents.length === 0 && (
                      <p className="text-[10px] font-bold text-error uppercase tracking-widest mt-4">
                        * Upload documents to enable analysis
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Data Room / Documents */}
              <div className="p-8 rounded-[32px] bg-surface border border-gray-100 shadow-soft">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-text-main flex items-center gap-3">
                    <div className="size-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                      <ShieldCheck className="size-4" />
                    </div>
                    {isOwner ? "Manage Data Room" : isPartner ? "Due Diligence Room" : "Secure Data Room"}
                  </h3>
                  <div className="flex gap-2">
                    {isOwner && (
                      <>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          onChange={handleFileUpload}
                          accept=".pdf,.doc,.docx"
                        />
                        <Button 
                          variant="outline" 
                          className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest rounded-xl border-gray-200"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? <Icons.spinner className="size-3 animate-spin mr-2" /> : <Icons.plus className="size-3 mr-2" />}
                          Upload Document
                        </Button>
                      </>
                    )}
                    {(isOwner || hasNda) && (
                      <Button 
                        variant="outline" 
                        className="h-9 px-4 text-[10px] font-bold uppercase tracking-widest rounded-xl border-gray-200"
                        onClick={() => {
                          if (!project?.documents || project.documents.length === 0) return;
                          alert('Please download files individually. Batch downloading is not currently supported by the storage setup.');
                        }}
                      >
                        <Download className="size-3 mr-2" /> Download All
                      </Button>
                    )}
                  </div>
                </div>
                <div className="grid gap-4">
                  {(isOwner || hasNda) ? (
                    project.documents && project.documents.length > 0 ? (
                      project.documents.map((doc, i) => (
                        <DocumentItem 
                          key={i} 
                          name={doc.document_type} 
                          size="N/A" 
                          date={new Date(doc.uploaded_at).toLocaleDateString()}
                          canDelete={isOwner}
                          onDelete={() => handleDeleteDocument(doc.id, doc.file_url)}
                          fileUrl={doc.file_url}
                        />
                      ))
                    ) : (
                      <div className="p-10 text-center border border-dashed border-gray-200 rounded-2xl">
                        <p className="text-sm font-bold text-text-muted uppercase tracking-widest">No documents uploaded yet</p>
                      </div>
                    )
                  ) : (
                    <div className="p-10 text-center bg-slate-50 rounded-2xl border border-gray-100">
                       <Icons.lock className="size-8 mx-auto text-text-muted mb-4" />
                       <h4 className="text-sm font-bold text-text-main mb-2">Documentation Locked</h4>
                       <p className="text-xs text-text-muted max-w-xs mx-auto mb-6">Access to the full data room is restricted until an NDA has been signed by both parties.</p>
                       {!isPartner && (
                         <Button className="h-10 px-6 bg-primary text-white rounded-xl shadow-lg font-bold">
                           Request Introduction
                         </Button>
                       )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Engagement Sidebar */}
            <div className="space-y-8">
              {/* Analytics Summary */}
              {!(!isOwner && isPartner) && (
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
                  <Link href={`/projects/${project.id}/analytics`}>
                    <Button className="w-full h-12 rounded-xl bg-primary text-primary-content font-bold mt-8 hover:scale-105 transition-all">
                      View Detailed Analytics
                    </Button>
                  </Link>
                </div>
              )}

              {/* Discussion Preview */}
              <div className="rounded-[32px] bg-surface border border-gray-100 shadow-soft overflow-hidden flex flex-col h-[400px]">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-text-main uppercase tracking-widest">Active Discussions</h3>
                    <p className="text-[10px] font-bold text-text-muted mt-1 uppercase">
                      {isOwner ? "3 Ongoing Threads" : "1 Ongoing Thread"}
                    </p>
                  </div>
                  <Icons.messageSquare className="size-5 text-primary" />
                </div>
                
                <div className="flex-grow p-6 overflow-y-auto no-scrollbar space-y-6">
                  {(!(!isOwner && isPartner)) && (
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                       <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">GC</div>
                       <div>
                          <p className="text-xs font-bold text-text-main mb-1">GreenGrowth Capital</p>
                          <p className="text-[10px] text-text-muted leading-relaxed font-medium">"Could you provide more detail on the grid connection timeline?"</p>
                       </div>
                    </div>
                  )}
                  {isOwner && (
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                       <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[10px]">NP</div>
                       <div>
                          <p className="text-xs font-bold text-text-main mb-1">Nordic Power Fund</p>
                          <p className="text-[10px] text-text-muted leading-relaxed font-medium">"NDA countersigned. Awaiting access to financial model."</p>
                       </div>
                    </div>
                  )}
                  {(!isOwner && isPartner) && (
                    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                       <div className="size-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-[10px]">YOU</div>
                       <div>
                          <p className="text-xs font-bold text-text-main mb-1">Your Thread</p>
                          <p className="text-[10px] text-text-muted leading-relaxed font-medium">"Awaiting response from developer..."</p>
                       </div>
                    </div>
                  )}
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
            projectTechnology={project.technology_type}
            capitalMatches={capitalMatches} 
            technicalMatches={technicalMatches} 
          />
        </div>
      </main>
    </div>
  );
}

function ChecklistItem({ label, checked }: { label: string, checked: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "size-5 rounded-full flex items-center justify-center border-2 transition-colors",
        checked ? "bg-green-500 border-green-500 text-white" : "bg-white border-gray-200 text-transparent"
      )}>
        <Check className="size-3" />
      </div>
      <span className="text-sm font-bold text-text-main">{label}</span>
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

function DocumentItem({ name, size, date, canDelete, onDelete, fileUrl }: { name: string, size: string, date: string, canDelete?: boolean, onDelete?: () => void, fileUrl?: string }) {
  const handleDownload = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div 
      className="flex items-center justify-between p-5 rounded-[20px] bg-background border border-gray-50 hover:border-primary/30 group transition-all cursor-pointer"
      onClick={handleDownload}
    >
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
          <FileText className="size-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{name}</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1.5">{size} • {date}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canDelete && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl hover:bg-error/10 hover:text-error h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <MoreVertical className="size-4 text-text-muted hover:text-text-main" />
      </div>
    </div>
  );
}

function OverrideSlider({ label, value, max, onChange }: { label: string, value: number, max: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <span className="text-[10px] font-black uppercase text-text-muted tracking-widest">{label}</span>
        <span className="text-xs font-bold text-primary">{value} / {max}</span>
      </div>
      <input 
        type="range" 
        min="0" 
        max={max} 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
      />
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

function ScorePillar({ label, score, max, color, details }: { label: string, score: number, max: number, color: string, details?: any }) {
  const percentage = (score / max) * 100;
  
  return (
    <div className="p-6 rounded-[24px] bg-white border border-gray-100 shadow-sm flex flex-col items-center">
      <div className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-4">{label}</div>
      <div className="relative size-24 flex items-center justify-center mb-4">
        <svg className="size-full -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-50"
          />
          <circle
            cx="48"
            cy="48"
            r="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={276}
            strokeDashoffset={276 - (276 * percentage) / 100}
            strokeLinecap="round"
            className={cn("transition-all duration-1000 text-opacity-80", color.replace('bg-', 'text-'))}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-text-main">{score}</span>
          <span className="text-[10px] font-bold text-text-muted">/ {max}</span>
        </div>
      </div>
      <div className="w-full space-y-2 mt-2">
        {details && Object.entries(details).slice(0, 2).map(([key, val]: [string, any]) => (
          <div key={key} className="flex justify-between items-center text-[9px] font-bold uppercase text-text-muted">
            <span>{key.replace(/_/g, ' ')}</span>
            <span className="text-text-main">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
