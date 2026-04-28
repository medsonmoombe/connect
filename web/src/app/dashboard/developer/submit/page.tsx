'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { storageService } from '@/lib/storage';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  ProjectStage,
  CapitalStructureType,
  ProjectTechRequirements
} from '@/types';

type Step = 1 | 2 | 3 | 4 | 5;

interface SelectedFile {
  file: File;
  type: string;
}

export default function ProjectSubmissionPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dummyFile = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    setSelectedFiles([
      { file: dummyFile, type: 'Pitch Deck' }
    ]);
  }, []);
  const router = useRouter();
  const { user: realUser } = useAuth();
  const user = realUser || { company_id: 'a1c396ae-8189-4ea5-b729-fe3cd8df4e9f' };

  // Form State
  const [formData, setFormData] = useState({
    name: 'CORS Test Project',
    technology_type: 'Solar',
    location_country: 'Zambia',
    location_region: '',
    project_size_mw: 0,
    capital_required: 0,
    capital_structure_type: 'EQUITY' as CapitalStructureType,
    project_stage: 'FEASIBILITY' as ProjectStage,
    target_financial_close_date: '',
    target_cod: '',
    governance_terms: '',
    exit_terms: '',
    risk_disclosures: '',
    has_secured_land: false,
    land_title_status: 'Not Applicable' as 'Traditional' | 'Titled' | 'Not Applicable',
    has_reached_financial_close: false,
    regulatory_approvals: [] as string[]
  });

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);

  const [techRequirements, setTechRequirements] = useState<Partial<ProjectTechRequirements>>({
    required_services: [],
    terrain_complexity: 'SIMPLE',
    grid_status: 'PENDING',
    budget_preference: 'FIXED'
  });

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const updateTechData = (data: Partial<ProjectTechRequirements>) => {
    setTechRequirements(prev => ({ ...prev, ...data }));
  };

  const mockFiles = () => {
    const dummyFile = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    setSelectedFiles([
      { file: dummyFile, type: 'Pitch Deck' }
    ]);
  };

  const handleNext = () => {
    if (step < 5) setStep((step + 1) as Step);
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const handleSubmit = async () => {
    // const companyId = user?.company_id || 'a1c396ae-8189-4ea5-b729-fe3cd8df4e9f';
    
    setLoading(true);
    try {
      console.log('Starting project submission workflow...');
      // 1. Create Project
      console.log("Hello");
      console.log('Step 1: Creating project record...');
      console.log(formData);
      const project = await projectService.createProject({
        ...formData,
        developer_id: user.company_id
      });
      console.log('Project created successfully:', project.id);

      // 2. Save Tech Requirements
      console.log('Step 2: Saving technical requirements...');
      await projectService.updateTechRequirements({
        ...techRequirements as ProjectTechRequirements,
        project_id: project.id
      });
      console.log('Technical requirements saved.');

      // 3. Upload Documents
      console.log('Step 3: Uploading documents to Firebase Storage...');
      const documentPaths: string[] = [];
      for (const item of selectedFiles) {
        console.log(`Uploading ${item.type}: ${item.file.name}...`);
        try {
          const { file_url, storage_path } = await storageService.uploadProjectDocument(
            project.id,
            item.file,
            item.type
          );
          
          console.log(`Upload successful for ${item.file.name}. Path: ${storage_path}`);
          documentPaths.push(storage_path);

          await projectService.addProjectDocument({
            project_id: project.id,
            document_type: item.type,
            file_url
          });
        } catch (uploadError: any) {
          console.error(`Upload failed for ${item.file.name}:`, uploadError);
          if (uploadError.code === 'storage/unauthorized' || uploadError.message?.includes('CORS')) {
            console.error('DIAGNOSIS: This is likely a CORS or Permissions issue. Ensure cors.json is applied.');
          }
          throw uploadError;
        }
      }

      // 4. Trigger AI Scoring (Cloud Function)
      if (functions) {
        console.log('Step 4: Triggering AI scoring engine...');
        try {
          const scoreProject = httpsCallable(functions, 'scoreProject');
          const scoringResponse: any = await scoreProject({
            projectId: project.id,
            documentPaths
          });

          console.log('AI Scoring response received:', scoringResponse);

          if (scoringResponse.data?.success) {
            const aiData = scoringResponse.data.data;
            await projectService.saveProjectScores({
              project_id: project.id,
              capital_readiness_score: Math.round(aiData.total_score || 0),
              regulatory_score: Math.round(aiData.breakdown?.regulatory?.score || 0),
              financial_score: Math.round(aiData.breakdown?.financial?.score || 0),
              developer_score: Math.round(aiData.breakdown?.developer?.score || 0),
              breakdown: aiData.breakdown,
              risk_flags: aiData.risk_signals?.map((s: any) => `${s.level}: ${s.text}`) || [],
              recommendations: aiData.recommendations || [],
              summary: aiData.summary || ''
            });
          }
        } catch (scoringError) {
          console.error('AI Scoring Error (non-blocking):', scoringError);
        }
      }

      // 5. Redirect to dashboard
      router.push('/dashboard/developer');
    } catch (error) {
      console.error('Error submitting project:', error);
      alert('Failed to submit project. Please check the form and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <Link href="/dashboard/developer" className="flex items-center gap-2 text-text-muted hover:text-text-main transition-colors font-bold text-sm uppercase tracking-widest">
            <Icons.arrowLeft className="size-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <div 
                key={s}
                className={cn(
                  "size-10 rounded-full flex items-center justify-center font-bold text-sm transition-all border-2",
                  step === s 
                    ? "bg-primary text-primary-content border-primary shadow-lg shadow-primary/20" 
                    : step > s 
                      ? "bg-primary/10 text-primary border-primary/20" 
                      : "bg-surface text-text-muted border-gray-100"
                )}
              >
                {step > s ? <Icons.check className="size-5" /> : s}
              </div>
            ))}
          </div>
        </div>

        <div className="premium-card p-10 bg-surface">
          <div className="mb-10 text-center max-w-2xl mx-auto">
            <Button onClick={mockFiles} variant="outline" className="mb-4">Mock Files</Button>
            <h1 className="text-3xl font-extrabold text-text-main mb-3">
              {step === 1 && "Project Identity"}
              {step === 2 && "Scale & Financials"}
              {step === 3 && "Timeline & Status"}
              {step === 4 && "Technical Requirements"}
              {step === 5 && "Narrative & Submission"}
            </h1>
            <p className="text-text-muted font-medium">
              {step === 1 && "Provide basic details about the infrastructure opportunity."}
              {step === 2 && "Define the capacity and capital structure of the project."}
              {step === 3 && "Help partners understand the current stage and expected milestones."}
              {step === 4 && "Specify what technical services and conditions apply to this site."}
              {step === 5 && "Add governance details and finalize your submission."}
            </p>
          </div>

          <div className="space-y-8">
            {step === 1 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Project Name</Label>
                    <Input 
                      placeholder="e.g. Lusaka South Solar II" 
                      value={formData.name}
                      onChange={(e) => updateFormData({ name: e.target.value })}
                      className="h-12 bg-background border-gray-100 rounded-xl px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Technology Type</Label>
                    <select 
                      className="w-full h-12 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={formData.technology_type}
                      onChange={(e) => updateFormData({ technology_type: e.target.value })}
                    >
                      <option>Solar</option>
                      <option>Wind</option>
                      <option>Hydro</option>
                      <option>Biomass</option>
                      <option>Geothermal</option>
                      <option>Hybrid</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Country</Label>
                    <Input 
                      value={formData.location_country}
                      onChange={(e) => updateFormData({ location_country: e.target.value })}
                      className="h-12 bg-background border-gray-100 rounded-xl px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Region/City</Label>
                    <Input 
                      placeholder="e.g. Lusaka District" 
                      value={formData.location_region}
                      onChange={(e) => updateFormData({ location_region: e.target.value })}
                      className="h-12 bg-background border-gray-100 rounded-xl px-4"
                    />
                  </div>
                </div>

                <div className="space-y-6 pt-6 border-t border-gray-50">
                  <h3 className="text-sm font-black text-text-main uppercase tracking-widest flex items-center gap-2">
                    <Icons.checkCircle2 className="size-4 text-primary" />
                    Project Readiness Checklist
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          id="secured_land"
                          checked={formData.has_secured_land}
                          onChange={(e) => updateFormData({ has_secured_land: e.target.checked })}
                          className="size-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="secured_land" className="text-sm font-bold text-text-main cursor-pointer">Have you secured the land?</Label>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Land Title Status</Label>
                        <select 
                          className="w-full h-11 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                          value={formData.land_title_status}
                          onChange={(e) => updateFormData({ land_title_status: e.target.value as any })}
                        >
                          <option value="Traditional">Traditional</option>
                          <option value="Titled">Titled</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          id="fin_close"
                          checked={formData.has_reached_financial_close}
                          onChange={(e) => updateFormData({ has_reached_financial_close: e.target.checked })}
                          className="size-5 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <Label htmlFor="fin_close" className="text-sm font-bold text-text-main cursor-pointer">Have you reached financial close?</Label>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Latest Regulatory Approvals</Label>
                        <div className="grid grid-cols-1 gap-2">
                          {['ZEMA approval letter', 'Grid Connection Agreement', 'Power Purchase Agreement (PPA)', 'Construction Permit'].map((approval) => (
                            <div key={approval} className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                id={approval}
                                checked={formData.regulatory_approvals.includes(approval)}
                                onChange={(e) => {
                                  const approvals = e.target.checked 
                                    ? [...formData.regulatory_approvals, approval]
                                    : formData.regulatory_approvals.filter(a => a !== approval);
                                  updateFormData({ regulatory_approvals: approvals });
                                }}
                                className="size-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <Label htmlFor={approval} className="text-xs font-medium text-text-muted cursor-pointer">{approval}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Project Size (MW)</Label>
                    <Input 
                      type="number"
                      placeholder="e.g. 50" 
                      value={formData.project_size_mw}
                      onChange={(e) => updateFormData({ project_size_mw: parseFloat(e.target.value) })}
                      className="h-12 bg-background border-gray-100 rounded-xl px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Capital Required (ZMW)</Label>
                    <Input 
                      type="number"
                      placeholder="e.g. 500000000" 
                      value={formData.capital_required}
                      onChange={(e) => updateFormData({ capital_required: parseFloat(e.target.value) })}
                      className="h-12 bg-background border-gray-100 rounded-xl px-4"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Capital Structure Type</Label>
                  <select 
                    className="w-full h-12 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.capital_structure_type}
                    onChange={(e) => updateFormData({ capital_structure_type: e.target.value as CapitalStructureType })}
                  >
                    <option value="EQUITY">Equity</option>
                    <option value="PROFIT_SHARING">Profit Sharing</option>
                    <option value="LEASING">Leasing</option>
                    <option value="GRANT">Grant</option>
                  </select>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Project Stage</Label>
                  <select 
                    className="w-full h-12 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={formData.project_stage}
                    onChange={(e) => updateFormData({ project_stage: e.target.value as ProjectStage })}
                  >
                    <option value="CONCEPT">Concept</option>
                    <option value="FEASIBILITY">Feasibility</option>
                    <option value="PRE_CONSTRUCTION">Pre-Construction</option>
                    <option value="READY_TO_BUILD">Ready to Build</option>
                    <option value="UNDER_CONSTRUCTION">Under Construction</option>
                    <option value="OPERATIONAL">Operational</option>
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Target Financial Close</Label>
                    <Input 
                      type="date"
                      value={formData.target_financial_close_date}
                      onChange={(e) => updateFormData({ target_financial_close_date: e.target.value })}
                      className="h-12 bg-background border-gray-100 rounded-xl px-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Target Project Go-Live</Label>
                    <Input 
                      type="date"
                      value={formData.target_cod}
                      onChange={(e) => updateFormData({ target_cod: e.target.value })}
                      className="h-12 bg-background border-gray-100 rounded-xl px-4"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Terrain Complexity</Label>
                    <select 
                      className="w-full h-12 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={techRequirements.terrain_complexity}
                      onChange={(e) => updateTechData({ terrain_complexity: e.target.value as any })}
                    >
                      <option value="SIMPLE">Simple</option>
                      <option value="MODERATE">Moderate</option>
                      <option value="COMPLEX">Complex</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Grid Status</Label>
                    <select 
                      className="w-full h-12 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                      value={techRequirements.grid_status}
                      onChange={(e) => updateTechData({ grid_status: e.target.value as any })}
                    >
                      <option value="CONNECTED">Connected</option>
                      <option value="PENDING">Pending</option>
                      <option value="OFF_GRID">Off Grid</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Budget Preference</Label>
                  <select 
                    className="w-full h-12 bg-background border border-gray-100 rounded-xl px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={techRequirements.budget_preference}
                    onChange={(e) => updateTechData({ budget_preference: e.target.value as any })}
                  >
                    <option value="FIXED">Fixed Price</option>
                    <option value="MILESTONE">Milestone Based</option>
                    <option value="NEGOTIABLE">Negotiable</option>
                  </select>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Governance Terms</Label>
                    <textarea 
                      placeholder="e.g. Board seat requirements, voting rights..."
                      className="w-full h-32 bg-background border border-gray-100 rounded-xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 no-scrollbar"
                      value={formData.governance_terms}
                      onChange={(e) => updateFormData({ governance_terms: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Risk Disclosures</Label>
                    <textarea 
                      placeholder="e.g. Environmental concerns, local grid instability..."
                      className="w-full h-32 bg-background border border-gray-100 rounded-xl p-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 no-scrollbar"
                      value={formData.risk_disclosures}
                      onChange={(e) => updateFormData({ risk_disclosures: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-6">
                  <Label className="text-xs font-bold uppercase tracking-widest text-text-muted">Project Documents</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      'Pitch Deck', 
                      'Financial Model', 
                      'Feasibility Study', 
                      'Environmental Audit',
                      'Land Title/Lease Agreement',
                      'Regulatory Approval Docs'
                    ].map((docType) => {
                      const existing = selectedFiles.find(f => f.type === docType);
                      return (
                        <div key={docType} className="p-4 rounded-xl border border-gray-100 bg-background flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "size-8 rounded-lg flex items-center justify-center",
                              existing ? "bg-primary/10 text-primary" : "bg-gray-100 text-gray-400"
                            )}>
                              <Icons.fileText className="size-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-text-main leading-none mb-1">{docType}</p>
                              <p className="text-[10px] text-text-muted font-medium">
                                {existing ? existing.file.name : "Required for vetting"}
                              </p>
                            </div>
                          </div>
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSelectedFiles(prev => [
                                    ...prev.filter(f => f.type !== docType),
                                    { file, type: docType }
                                  ]);
                                }
                              }}
                            />
                            <div className="size-8 rounded-lg border border-gray-100 flex items-center justify-center text-text-muted hover:text-primary transition-colors">
                              <Icons.plus className="size-4" />
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div className="pt-10 border-t border-gray-50 flex items-center justify-between">
              <Button 
                variant="ghost" 
                onClick={handleBack}
                disabled={step === 1 || loading}
                className="h-12 px-6 rounded-xl font-bold text-text-muted hover:text-text-main"
              >
                Back
              </Button>
              
              {step < 5 ? (
                <Button 
                  onClick={handleNext}
                  className="h-12 px-10 rounded-xl bg-primary text-primary-content hover:opacity-90 font-bold shadow-lg shadow-primary/20 transition-all flex gap-2"
                >
                  Next Step
                  <Icons.arrowRight className="size-4" />
                </Button>
              ) : (
                <Button 
                  onClick={handleSubmit}
                  disabled={loading}
                  className="h-12 px-10 rounded-xl bg-primary text-primary-content hover:opacity-90 font-bold shadow-lg shadow-primary/20 transition-all flex gap-2"
                >
                  {loading ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.check className="size-4" />}
                  Submit Project
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
