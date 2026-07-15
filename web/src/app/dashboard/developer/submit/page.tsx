'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { projectService } from '@/services/projects';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { storageService } from '@/lib/storage';
import { functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  TECHNOLOGY_TYPES,
  PROJECT_STAGES,
  CAPITAL_STRUCTURE_TYPES,
  LAND_TITLE_STATUSES,
  TERRAIN_COMPLEXITY,
  GRID_STATUS,
  BUDGET_PREFERENCE,
} from '@/lib/project-validation';
import type { ProjectStage, CapitalStructureType } from '@/types';

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_META: Record<Step, { label: string; subtitle: string; icon: any }> = {
  1: { label: 'Project Identity', subtitle: 'Provide basic details about the infrastructure opportunity.', icon: Icons.building },
  2: { label: 'Scale & Financials', subtitle: 'Define the capacity and capital structure of the project.', icon: Icons.dollarSign },
  3: { label: 'Timeline & Status', subtitle: 'Help partners understand the current stage and expected milestones.', icon: Icons.briefcase },
  4: { label: 'Technical Requirements', subtitle: 'Specify what technical services and conditions apply to this site.', icon: Icons.settings },
  5: { label: 'Narrative & Submission', subtitle: 'Add governance details, upload documents, and submit for review.', icon: Icons.send },
};

const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const COUNTRIES = [
  'Zambia', 'Democratic Republic of Congo', 'Zimbabwe', 'Mozambique', 'Botswana',
  'Namibia', 'Malawi', 'Angola', 'Tanzania', 'Kenya', 'Nigeria', 'South Africa',
  'Ghana', 'Uganda', 'Rwanda', 'Senegal', 'Ethiopia', 'Egypt',
];

const COUNTRY_REGIONS: Record<string, string[]> = {
  'Zambia': ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'Northern', 'North-Western', 'Southern', 'Western'],
  'Nigeria': ['Abuja', 'Lagos', 'Kano', 'Rivers', 'Oyo', 'Kaduna', 'Enugu', 'Anambra', 'Delta', 'Ogun'],
  'Kenya': ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Nyeri', 'Eldoret', 'Machakos', 'Kiambu', 'Meru', 'Kilifi'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'],
  'Tanzania': ['Dar es Salaam', 'Dodoma', 'Arusha', 'Mwanza', 'Mbeya', 'Zanzibar', 'Tanga', 'Morogoro', 'Kilimanjaro', 'Rukwa'],
  'Ghana': ['Greater Accra', 'Ashanti', 'Western', 'Central', 'Northern', 'Volta', 'Eastern', 'Brong-Ahafo', 'Upper East', 'Upper West'],
  'Uganda': ['Central', 'Eastern', 'Northern', 'Western'],
  'Rwanda': ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'],
  'Ethiopia': ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'SNNPR', 'Somali', 'Benishangul-Gumuz', 'Gambela', 'Dire Dawa'],
  'Egypt': ['Cairo', 'Alexandria', 'Giza', 'Luxor', 'Aswan', 'Port Said', 'Suez', 'Ismailia', 'Red Sea', 'Matrouh'],
  'Mozambique': ['Maputo', 'Gaza', 'Inhambane', 'Sofala', 'Zambezia', 'Nampula', 'Cabo Delgado', 'Niassa', 'Tete', 'Manica'],
  'Zimbabwe': ['Harare', 'Bulawayo', 'Midlands', 'Manicaland', 'Mashonaland West', 'Mashonaland Central', 'Mashonaland East', 'Masvingo', 'Matabeleland North', 'Matabeleland South'],
  'Botswana': ['Gaborone', 'Francistown', 'Selebi-Phikwe', 'Maun', 'Kasane', 'Serowe', 'Palapye', 'Molepolole', 'Mochudi', 'Lobatse'],
  'Namibia': ['Windhoek', 'Walvis Bay', 'Swakopmund', 'Oshakati', 'Rundu', 'Grootfontein', 'Katima Mulilo', 'Keetmanshoop', 'Otjiwarongo', 'Gobabis'],
  'Malawi': ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Mangochi', 'Karonga', 'Nkhotakota', 'Ntcheu', 'Balaka', 'Mulanje'],
  'Angola': ['Luanda', 'Benguela', 'Huíla', 'Huambo', 'Lunda Norte', 'Lunda Sul', 'Cabinda', 'Uíge', 'Malanje', 'Bié'],
  'Senegal': ['Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack', 'Touba', 'Mbour', 'Rufisque', 'Diourbel', 'Fatick'],
  'Democratic Republic of Congo': ['Kinshasa', 'Haut-Katanga', 'Kivu du Nord', 'Kivu du Sud', 'Kasaï-Oriental', 'Kasaï-Central', 'Équateur', 'Tshopo', 'Maniema', 'Haut-Uélé'],
};

const inputClass = "w-full h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm";
const selectClass = "w-full h-10 px-4 pr-10 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium text-sm appearance-none";
const labelClass = "text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1";
const textareaClass = "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-600/20 focus:border-green-600 transition-all text-slate-900 font-medium resize-none text-sm";

interface SelectedFile {
  file: File;
  type: string;
}

function StepSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-lg" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectSubmissionPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const editProjectId = searchParams.get('edit');
  const isEditing = !!editProjectId;
  const { user: realUser } = useAuth();

  const [orgMode, setOrgMode] = useState<'direct' | 'internal_review'>('direct');
  const [isInternalReviewer, setIsInternalReviewer] = useState(false);

  useEffect(() => {
    if (!realUser?.company_id) return;
    import('@/lib/api-client').then(({ apiClient }) => {
      apiClient.get<{ settings: { project_submission_mode?: string; internal_reviewer_id?: string } }>(
        '/org/settings'
      ).then(({ settings }) => {
        const mode = settings.project_submission_mode === 'internal_review' ? 'internal_review' : 'direct';
        setOrgMode(mode);
        if (mode === 'internal_review') {
          setIsInternalReviewer(settings.internal_reviewer_id === realUser.id);
        }
      }).catch(() => {}).finally(() => setPageLoading(false));
    });
  }, [realUser]);

  // Edit mode: fetch existing project and pre-fill form
  useEffect(() => {
    if (!editProjectId) { setPageLoading(false); return; }
    projectService.getProjectDetails(editProjectId).then((p: any) => {
      setProjectId(p.id);
      setFormData({
        name: p.name || '',
        technology_type: p.technology_type || 'PHOTOVOLTAIC',
        location_country: p.location_country || '',
        location_region: p.location_region || '',
        project_size_mw: p.project_size_mw || 0,
        capital_required: p.capital_required || 0,
        capital_structure_type: p.capital_structure_type || 'EQUITY',
        project_stage: p.project_stage || 'CONCEPT',
        target_financial_close_date: p.target_financial_close_date || '',
        target_cod: p.target_cod || '',
        governance_terms: p.governance_terms || '',
        exit_terms: p.exit_terms || '',
        risk_disclosures: p.risk_disclosures || '',
        has_secured_land: p.has_secured_land || false,
        land_title_status: p.land_title_status || 'Not Applicable',
        has_reached_financial_close: p.has_reached_financial_close || false,
        regulatory_approvals: p.regulatory_approvals || [],
      });
      const tech = p.tech_requirements;
      if (tech) {
        setTechRequirements({
          required_services: tech.required_services || [],
          terrain_complexity: tech.terrain_complexity || 'SIMPLE',
          grid_status: tech.grid_status || 'PENDING',
          budget_preference: tech.budget_preference || 'FIXED',
        });
      }
      setPageLoading(false);
      toast.success('Loaded existing project data');
    }).catch((err) => {
      console.error('Failed to load project:', err);
      toast.error('Failed to load project for editing');
      router.push('/dashboard/developer');
    });
  }, [editProjectId]);

  const [formData, setFormData] = useState({
    name: '',
    technology_type: 'PHOTOVOLTAIC',
    location_country: '',
    location_region: '',
    project_size_mw: 0,
    capital_required: 0,
    capital_structure_type: 'EQUITY' as CapitalStructureType,
    project_stage: 'CONCEPT' as ProjectStage,
    target_financial_close_date: '',
    target_cod: '',
    governance_terms: '',
    exit_terms: '',
    risk_disclosures: '',
    has_secured_land: false,
    land_title_status: 'Not Applicable' as 'Traditional' | 'Titled' | 'Not Applicable',
    has_reached_financial_close: false,
    regulatory_approvals: [] as string[],
  });

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const [techRequirements, setTechRequirements] = useState({
    required_services: [] as string[],
    terrain_complexity: 'SIMPLE',
    grid_status: 'PENDING',
    budget_preference: 'FIXED',
  });

  const creatingRef = useRef(false);

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    setErrors(prev => {
      const next = { ...prev };
      Object.keys(data).forEach(k => delete next[k]);
      return next;
    });
  };

  const updateTechData = (data: Partial<typeof techRequirements>) => {
    setTechRequirements(prev => ({ ...prev, ...data }));
  };

  const validateStep = (stepNum: Step): boolean => {
    setErrors({});
    let result;
    switch (stepNum) {
      case 1: result = step1Schema.safeParse(formData); break;
      case 2: result = step2Schema.safeParse(formData); break;
      case 3: result = step3Schema.safeParse(formData); break;
      case 4: result = step4Schema.safeParse(techRequirements); break;
      case 5: result = step5Schema.safeParse(formData); break;
    }
    if (result && !result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const key = err.path[0] as string;
        fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      toast.error('Please fix the highlighted fields.');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;
    if (step < 5) {
      toast.success(`Step ${step} complete — moving to ${STEP_META[(step + 1) as Step].label}`);
      setStep((step + 1) as Step);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep((step - 1) as Step);
  };

  const saveDraft = useCallback(async () => {
    if (!realUser?.company_id) return;
    // Guard against concurrent creates
    if (!projectId && creatingRef.current) return;
    try {
      if (projectId) {
        await projectService.updateProject(projectId, formData);
      } else {
        creatingRef.current = true;
        const project = await projectService.createProject({
          ...formData,
          developer_id: realUser.company_id,
        });
        setProjectId(project.id);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    } finally {
      creatingRef.current = false;
    }
  }, [projectId, formData, realUser]);

  useEffect(() => {
    if (isEditing) return; // Don't auto-save during edit mode — user saves manually
    if (!projectId && formData.name.length < 3) return;
    const timer = setTimeout(saveDraft, 3000);
    return () => clearTimeout(timer);
  }, [formData, projectId, saveDraft, isEditing]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      return `"${file.name}" is not a supported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `"${file.name}" exceeds the 50MB size limit.`;
    }
    return null;
  };

  const handleFileSelect = (docType: string, file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrors(prev => ({ ...prev, [docType]: error }));
      toast.error(error);
      return;
    }
    setErrors(prev => {
      const next = { ...prev };
      delete next[docType];
      return next;
    });
    setSelectedFiles(prev => [...prev.filter(f => f.type !== docType), { file, type: docType }]);
    toast.success(`${docType} attached`);
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    setLoading(true);
    const submitToast = toast.loading(isEditing ? 'Saving changes...' : 'Submitting project...');

    try {
      let currentProjectId = projectId;

      if (!currentProjectId) {
        const project = await projectService.createProject({
          ...formData,
          developer_id: realUser!.company_id,
        });
        currentProjectId = project.id;
        setProjectId(project.id);
      } else {
        await projectService.updateProject(currentProjectId, formData);
      }

      await projectService.updateTechRequirements({
        ...techRequirements,
        project_id: currentProjectId,
      } as any);

      const documentPaths: string[] = [];
      for (const item of selectedFiles) {
        try {
          const { file_url, storage_path } = await storageService.uploadProjectDocument(
            currentProjectId!,
            item.file,
            item.type,
            (progress) => {
              setUploadProgress(prev => ({ ...prev, [item.file.name]: progress }));
            }
          );
          documentPaths.push(storage_path);
          await projectService.addProjectDocument({
            project_id: currentProjectId!,
            document_type: item.type,
            file_url,
            storage_path,
          });
        } catch (uploadError: any) {
          console.error(`Upload failed for ${item.file.name}:`, uploadError);
          throw uploadError;
        }
      }

      if (isEditing) {
        toast.success('Project updated successfully!', { id: submitToast });
        router.push('/dashboard/developer');
        return;
      }

      await projectService.submitProject(currentProjectId!);

      if (functions && documentPaths.length > 0) {
        try {
          const scoreProject = httpsCallable(functions, 'scoreProject');
          const scoringResponse: any = await scoreProject({
            projectId: currentProjectId,
            documentPaths,
          });
          if (scoringResponse.data?.success) {
            const aiData = scoringResponse.data.data;
            await projectService.saveProjectScores({
              project_id: currentProjectId,
              capital_readiness_score: Math.round(aiData.total_score || 0),
              regulatory_score: Math.round(aiData.breakdown?.regulatory?.score || 0),
              financial_score: Math.round(aiData.breakdown?.financial?.score || 0),
              developer_score: Math.round(aiData.breakdown?.developer?.score || 0),
              breakdown: aiData.breakdown,
              risk_flags: aiData.risk_signals?.map((s: any) => `${s.level}: ${s.text}`) || [],
              recommendations: aiData.recommendations || [],
              summary: aiData.summary || '',
            });
          }
        } catch (scoringError: any) {
          console.error('AI Scoring Error (non-blocking):', scoringError);
        }
      }

      toast.success('Project submitted for review!', { id: submitToast });
      router.push('/dashboard/developer');
    } catch (error: any) {
      console.error('Error submitting project:', error);
      const errorMessage = error?.message || error?.code || 'Failed to submit project';
      setErrors({ _submit: errorMessage });
      toast.error(errorMessage, { id: submitToast });
    } finally {
      setLoading(false);
    }
  };

  const progress = ((step) / 5) * 100;
  const displayErrors = Object.entries(errors).filter(([k]) => !k.startsWith('_'));

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8 animate-in fade-in duration-500">

        {/* ── Back link ── */}
        <Link href="/dashboard/developer" className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest hover:text-primary transition-colors">
          <Icons.arrowLeft className="size-3.5" />
          Back to Dashboard
        </Link>

        {/* ── Edit mode banner ── */}
        {isEditing && (
          <div className="dash-card p-4 flex items-center gap-3 border-l-4 border-amber-400">
            <Icons.pencil className="size-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-900">Editing Project</p>
              <p className="text-xs text-slate-500">Changes will be saved when you click Save at the bottom.</p>
            </div>
          </div>
        )}

        {/* ── Step indicator ── */}
        <div className="dash-card p-6">
          <div className="flex items-center justify-between mb-4">
            {([1, 2, 3, 4, 5] as Step[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "size-9 rounded-full flex items-center justify-center font-bold text-xs transition-all border-2 shrink-0",
                    step === s
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                      : step > s
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-slate-50 text-slate-400 border-slate-200"
                  )}
                >
                  {step > s ? <Icons.check className="size-4" /> : s}
                </div>
                <span className={cn(
                  "text-[11px] font-bold uppercase tracking-widest hidden md:block",
                  step === s ? "text-primary" : step > s ? "text-primary/60" : "text-slate-300"
                )}>
                  {STEP_META[s].label}
                </span>
                {s < 5 && (
                  <div className={cn(
                    "w-8 h-0.5 rounded-full mx-1 hidden md:block",
                    step > s ? "bg-primary/30" : "bg-slate-100"
                  )} />
                )}
              </div>
            ))}
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary to-primary-light h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* ── Main form card ── */}
        <div className="dash-card p-8 md:p-10">
          {/* Step header */}
          <div className="mb-8 text-center max-w-xl mx-auto">
            <div className="inline-flex items-center justify-center size-12 rounded-2xl bg-primary/10 mb-4">
              {(() => { const StepIcon = STEP_META[step].icon; return <StepIcon className="size-6 text-primary" />; })()}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
              {STEP_META[step].label}
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              {STEP_META[step].subtitle}
            </p>
          </div>

          {/* Global errors */}
          {errors._submit && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3">
              <Icons.alertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Submission failed</p>
                <p className="text-xs text-red-600 mt-0.5">{errors._submit}</p>
              </div>
            </div>
          )}

          {displayErrors.length > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-3">
              <Icons.alertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">Please fix the following:</p>
                {displayErrors.map(([key, msg]) => (
                  <p key={key} className="text-xs text-amber-600">{msg}</p>
                ))}
              </div>
            </div>
          )}

          {/* Step content */}
          <div className="space-y-6">
            {pageLoading ? <StepSkeleton /> : (
              <>
                {/* ─── Step 1: Project Identity ─── */}
                {step === 1 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelClass}>Project Name *</label>
                        <input
                          placeholder="e.g. Lusaka South Solar II"
                          value={formData.name}
                          onChange={(e) => updateFormData({ name: e.target.value })}
                          className={cn(inputClass, errors.name && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                        />
                        {errors.name && <p className="text-[10px] text-red-500 font-medium">{errors.name}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Technology Type *</label>
                        <div className="relative">
                          <select
                            value={formData.technology_type}
                            onChange={(e) => updateFormData({ technology_type: e.target.value as any })}
                            className={selectClass}
                          >
                            {TECHNOLOGY_TYPES.map(t => (
                              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelClass}>Country *</label>
                        <div className="relative">
                          <select
                            value={formData.location_country}
                            onChange={(e) => updateFormData({ location_country: e.target.value, location_region: '' })}
                            className={cn(selectClass, errors.location_country && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                          >
                            <option value="">Select country...</option>
                            {COUNTRIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                        {errors.location_country && <p className="text-[10px] text-red-500 font-medium">{errors.location_country}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Region / City *</label>
                        {COUNTRY_REGIONS[formData.location_country] ? (
                          <div className="relative">
                            <select
                              value={formData.location_region}
                              onChange={(e) => updateFormData({ location_region: e.target.value })}
                              className={cn(selectClass, errors.location_region && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                            >
                              <option value="">Select region...</option>
                              {COUNTRY_REGIONS[formData.location_country].map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                          </div>
                        ) : (
                          <input
                            placeholder="e.g. Lusaka District"
                            value={formData.location_region}
                            onChange={(e) => updateFormData({ location_region: e.target.value })}
                            className={cn(inputClass, errors.location_region && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                          />
                        )}
                        {errors.location_region && <p className="text-[10px] text-red-500 font-medium">{errors.location_region}</p>}
                      </div>
                    </div>

                    {/* Readiness checklist */}
                    <div className="pt-6 border-t border-slate-100 space-y-5">
                      <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <Icons.checkCircle2 className="size-3.5 text-primary" />
                        Project Readiness Checklist
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-primary/30 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.has_secured_land}
                              onChange={(e) => updateFormData({ has_secured_land: e.target.checked })}
                              className="size-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                            />
                            <span className="text-sm font-semibold text-slate-700">Have you secured the land?</span>
                          </label>
                          <div className="space-y-2 ml-1">
                            <label className={labelClass}>Land Title Status</label>
                            <div className="relative">
                              <select
                                value={formData.land_title_status}
                                onChange={(e) => updateFormData({ land_title_status: e.target.value as any })}
                                className={selectClass}
                              >
                                {LAND_TITLE_STATUSES.map(s => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                              <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-primary/30 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.has_reached_financial_close}
                              onChange={(e) => updateFormData({ has_reached_financial_close: e.target.checked })}
                              className="size-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                            />
                            <span className="text-sm font-semibold text-slate-700">Have you reached financial close?</span>
                          </label>
                          <div className="space-y-2 ml-1">
                            <label className={labelClass}>Latest Regulatory Approvals</label>
                            <div className="space-y-1.5">
                              {['ZEMA approval letter', 'Grid Connection Agreement', 'Power Purchase Agreement (PPA)', 'Construction Permit'].map((approval) => (
                                <label key={approval} className="flex items-center gap-2.5 cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={formData.regulatory_approvals.includes(approval)}
                                    onChange={(e) => {
                                      const approvals = e.target.checked
                                        ? [...formData.regulatory_approvals, approval]
                                        : formData.regulatory_approvals.filter(a => a !== approval);
                                      updateFormData({ regulatory_approvals: approvals });
                                    }}
                                    className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                                  />
                                  <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 transition-colors">{approval}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ─── Step 2: Scale & Financials ─── */}
                {step === 2 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelClass}>Project Size (MW) *</label>
                        <input
                          type="number"
                          placeholder="e.g. 50"
                          value={formData.project_size_mw || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateFormData({ project_size_mw: val === '' ? 0 : parseFloat(val) });
                          }}
                          className={cn(inputClass, errors.project_size_mw && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                        />
                        {errors.project_size_mw && <p className="text-[10px] text-red-500 font-medium">{errors.project_size_mw}</p>}
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Capital Required (ZMW) *</label>
                        <input
                          type="number"
                          placeholder="e.g. 500000000"
                          value={formData.capital_required || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateFormData({ capital_required: val === '' ? 0 : parseFloat(val) });
                          }}
                          className={cn(inputClass, errors.capital_required && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                        />
                        {errors.capital_required && <p className="text-[10px] text-red-500 font-medium">{errors.capital_required}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Capital Structure Type *</label>
                      <div className="relative">
                        <select
                          value={formData.capital_structure_type}
                          onChange={(e) => updateFormData({ capital_structure_type: e.target.value as CapitalStructureType })}
                          className={selectClass}
                        >
                          {CAPITAL_STRUCTURE_TYPES.map(t => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </>
                )}

                {/* ─── Step 3: Timeline & Status ─── */}
                {step === 3 && (
                  <>
                    <div className="space-y-2">
                      <label className={labelClass}>Project Stage *</label>
                      <div className="relative">
                        <select
                          value={formData.project_stage}
                          onChange={(e) => updateFormData({ project_stage: e.target.value as ProjectStage })}
                          className={cn(selectClass, errors.project_stage && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                        >
                          {PROJECT_STAGES.map(s => (
                            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      </div>
                      {errors.project_stage && <p className="text-[10px] text-red-500 font-medium">{errors.project_stage}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelClass}>Target Financial Close</label>
                        <input
                          type="date"
                          value={formData.target_financial_close_date}
                          onChange={(e) => updateFormData({ target_financial_close_date: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Target Project Go-Live</label>
                        <input
                          type="date"
                          value={formData.target_cod}
                          onChange={(e) => updateFormData({ target_cod: e.target.value })}
                          className={cn(inputClass, errors.target_cod && "border-red-300 focus:ring-red-300/20 focus:border-red-400")}
                        />
                        {errors.target_cod && <p className="text-[10px] text-red-500 font-medium">{errors.target_cod}</p>}
                      </div>
                    </div>
                  </>
                )}

                {/* ─── Step 4: Technical Requirements ─── */}
                {step === 4 && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className={labelClass}>Terrain Complexity *</label>
                        <div className="relative">
                          <select
                            value={techRequirements.terrain_complexity}
                            onChange={(e) => updateTechData({ terrain_complexity: e.target.value as any })}
                            className={selectClass}
                          >
                            {TERRAIN_COMPLEXITY.map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className={labelClass}>Grid Status *</label>
                        <div className="relative">
                          <select
                            value={techRequirements.grid_status}
                            onChange={(e) => updateTechData({ grid_status: e.target.value as any })}
                            className={selectClass}
                          >
                            {GRID_STATUS.map(g => (
                              <option key={g} value={g}>{g.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                          <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className={labelClass}>Budget Preference *</label>
                      <div className="relative">
                        <select
                          value={techRequirements.budget_preference}
                          onChange={(e) => updateTechData({ budget_preference: e.target.value as any })}
                          className={selectClass}
                        >
                          {BUDGET_PREFERENCE.map(b => (
                            <option key={b} value={b}>{b === 'MILESTONE' ? 'Milestone Based' : b === 'FIXED' ? 'Fixed Price' : 'Negotiable'}</option>
                          ))}
                        </select>
                        <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </>
                )}

                {/* ─── Step 5: Narrative & Submission ─── */}
                {step === 5 && (
                  <>
                    {/* ── Optional: Governance ── */}
                    <div className="space-y-5">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Optional Details</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className={labelClass}>Governance Terms</label>
                          <textarea
                            placeholder="e.g. Board seat requirements, voting rights..."
                            className={textareaClass}
                            rows={3}
                            value={formData.governance_terms}
                            onChange={(e) => updateFormData({ governance_terms: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Exit Terms</label>
                          <textarea
                            placeholder="e.g. Buyback provisions, transfer restrictions..."
                            className={textareaClass}
                            rows={3}
                            value={formData.exit_terms}
                            onChange={(e) => updateFormData({ exit_terms: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className={labelClass}>Risk Disclosures</label>
                          <textarea
                            placeholder="e.g. Environmental concerns, local grid instability..."
                            className={textareaClass}
                            rows={3}
                            value={formData.risk_disclosures}
                            onChange={(e) => updateFormData({ risk_disclosures: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    {/* ── Documents ── */}
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Project Documents</label>
                        <p className="text-xs text-slate-400 font-medium mt-1 ml-1">At least 1 document required. PDF, DOC, DOCX, XLS, XLSX, PNG, JPG. Max 50MB each.</p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {[
                          'Pitch Deck',
                          'Financial Model',
                          'Feasibility Study',
                          'Environmental Audit',
                          'Land Title/Lease Agreement',
                          'Regulatory Approval Docs',
                        ].map((docType) => {
                          const existing = selectedFiles.find(f => f.type === docType);
                          const docError = errors[docType];
                          const progressVal = uploadProgress[existing?.file.name ?? ''];
                          return (
                            <div key={docType} className={cn(
                              "p-4 rounded-xl border bg-slate-50/50 flex flex-col gap-2 transition-all",
                              existing ? "border-primary/20 bg-primary/[0.02]" : "border-slate-100",
                              docError && "border-red-200 bg-red-50/30"
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "size-9 rounded-xl flex items-center justify-center shrink-0",
                                    existing ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                                  )}>
                                    <Icons.fileText className="size-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-700 leading-none mb-1">{docType}</p>
                                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">
                                      {existing ? existing.file.name : 'Optional'}
                                    </p>
                                  </div>
                                </div>
                                <label className="cursor-pointer shrink-0">
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileSelect(docType, file);
                                    }}
                                  />
                                  <div className={cn(
                                    "size-8 rounded-lg border flex items-center justify-center transition-colors",
                                    existing
                                      ? "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                                      : "border-slate-200 text-slate-400 hover:text-primary hover:border-primary/30"
                                  )}>
                                    {existing ? <Icons.check className="size-4" /> : <Icons.plus className="size-4" />}
                                  </div>
                                </label>
                              </div>
                              {typeof progressVal === 'number' && progressVal < 100 && (
                                <div className="w-full bg-slate-200 rounded-full h-1 overflow-hidden">
                                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${progressVal}%` }} />
                                </div>
                              )}
                              {docError && <p className="text-[10px] text-red-500 font-medium">{docError}</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Review Summary + Submit (at the bottom) ── */}
                    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/80 overflow-hidden">
                      <div className="px-6 py-4 bg-gradient-to-r from-green-800 to-green-700 flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-white/15 flex items-center justify-center">
                          <Icons.checkCircle2 className="size-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{isEditing ? 'Review & Save' : 'Review & Submit'}</h3>
                          <p className="text-[11px] text-green-200 font-medium">{isEditing ? 'Confirm your changes and save.' : 'Confirm your details and submit for review.'}</p>
                        </div>
                      </div>
                      <div className="p-6 space-y-4">
                        {/* Project name + tech type */}
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-bold text-slate-900 tracking-tight">{formData.name || 'Untitled Project'}</p>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">{formData.technology_type.replace(/_/g, ' ')} &middot; {formData.location_country || 'No country'}</p>
                          </div>
                          <span className={cn(
                            "shrink-0 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                            formData.project_stage === 'CONCEPT' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            formData.project_stage === 'FEASIBILITY' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            formData.project_stage === 'PERMITTING' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                            'bg-green-50 text-green-700 border-green-100'
                          )}>
                            {formData.project_stage.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Key metrics grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: 'Capacity', value: formData.project_size_mw ? `${formData.project_size_mw} MW` : '—' },
                            { label: 'Capital', value: formData.capital_required ? `ZMW ${(formData.capital_required / 1_000_000).toFixed(1)}M` : '—' },
                            { label: 'Structure', value: formData.capital_structure_type.replace(/_/g, ' ') },
                            { label: 'Region', value: formData.location_region || '—' },
                          ].map(item => (
                            <div key={item.label} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.label}</p>
                              <p className="text-sm font-bold text-slate-800 mt-1 capitalize">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Readiness tags */}
                        <div className="flex flex-wrap gap-2">
                          {formData.has_secured_land && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.check className="size-3" /> Land Secured
                            </span>
                          )}
                          {formData.has_reached_financial_close && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.check className="size-3" /> Financial Close
                            </span>
                          )}
                          {formData.regulatory_approvals.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.check className="size-3" /> {formData.regulatory_approvals.length} Approval{formData.regulatory_approvals.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {selectedFiles.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                              <Icons.fileText className="size-3" /> {selectedFiles.length} Document{selectedFiles.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Submit CTA */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="text-xs text-slate-400 font-medium">
                            <p>By submitting, your project will be sent for review.</p>
                            {orgMode === 'internal_review' && (
                              <p className="text-blue-600 mt-1">Your designated internal reviewer will be notified to approve before platform review.</p>
                            )}
                            {orgMode === 'direct' && (
                              <p className="text-blue-600 mt-1">This will go directly to the platform team for review.</p>
                            )}
                          </div>
                          <Button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="h-11 px-10 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-900/20 text-sm flex gap-2 disabled:opacity-50 shrink-0"
                          >
                            {loading ? <Icons.spinner className="size-4 animate-spin" /> : <Icons.send className="size-4" />}
                            {isEditing ? 'Save Changes' : 'Submit for Review'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* ── Navigation footer ── */}
          {!pageLoading && (
            <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={step === 1 || loading}
                className="h-10 px-5 rounded-xl font-bold text-slate-400 hover:text-slate-700 text-sm"
              >
                <Icons.arrowLeft className="size-4 mr-1.5" />
                Back
              </Button>

              {step < 5 && (
                <Button
                  onClick={handleNext}
                  className="h-10 px-8 rounded-xl bg-green-800 hover:bg-green-700 text-white font-bold shadow-lg shadow-green-900/20 text-sm flex gap-2"
                >
                  Continue
                  <Icons.arrowRight className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
