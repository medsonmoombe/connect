'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { Project, Engagement, Message, EngagementStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import Link from 'next/link';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

export default function ProjectDetailsPage({ params }: ProjectPageProps) {
  const { id: projectId } = use(params);
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  
  const [project, setProject] = useState<Project | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch project details
        const { data: projectData, error: projectError } = await supabase
          .from('projects')
          .select('*, developer:users(*)')
          .eq('id', projectId)
          .single();

        if (projectError) throw projectError;
        setProject(projectData as Project);

        // Fetch engagement for this project and user
        // Note: For simplicity in the MVP, we assume there's one primary engagement 
        // per project for the viewing user.
        const { data: engagementData, error: engagementError } = await supabase
          .from('engagements')
          .select('*')
          .eq('project_id', projectId)
          .maybeSingle();

        if (engagementData) {
          setEngagement(engagementData as Engagement);
          
          // Fetch messages for this engagement
          const { data: messagesData } = await supabase
            .from('messages')
            .select('*, sender:users(*)')
            .eq('engagement_id', engagementData.id)
            .order('created_at', { ascending: true });
            
          setMessages(messagesData as Message[] || []);
        }
      } catch (err) {
        console.error('Error fetching project data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [projectId, user, authLoading, router]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !engagement || !user || isSending) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          engagement_id: engagement.id,
          sender_id: user.id,
          message_body: newMessage.trim()
        })
        .select('*, sender:users(*)')
        .single();

      if (error) throw error;
      
      setMessages([...messages, data as Message]);
      setNewMessage('');
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const steps: { status: EngagementStatus; label: string }[] = [
    { status: 'INTRO_SENT', label: 'Initial Match' },
    { status: 'INTRO_ACCEPTED', label: 'NDA Signed' },
    { status: 'DUE_DILIGENCE', label: 'Due Diligence' },
    { status: 'TERM_SHEET', label: 'Term Sheet' },
    { status: 'CONTRACT_SIGNED', label: 'Contract' },
    { status: 'CLOSED', label: 'Closed' }
  ];

  const getCurrentStepIndex = () => {
    if (!engagement) return -1;
    return steps.findIndex(s => s.status === engagement.status);
  };

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#102217]">
        <Icons.spinner className="h-8 w-8 animate-spin text-[#2bee79]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#102217] text-white">
        <h1 className="text-2xl font-bold mb-4">Project not found</h1>
        <Link href="/dashboard" className="text-[#2bee79] hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 flex flex-col font-display">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-[#152e20] px-10 py-3">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="flex items-center gap-4 text-[#111814] dark:text-white">
            <div className="size-8 text-[#2bee79]">
              <svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5z"></path>
              </svg>
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-[-0.015em]">Energy Capital Match</h2>
          </Link>
          <div className="flex items-center gap-9 hidden md:flex">
            <Link className="text-slate-600 dark:text-slate-300 hover:text-[#2bee79] text-sm font-medium leading-normal" href="/dashboard">Dashboard</Link>
            <Link className="text-slate-900 dark:text-white text-sm font-medium leading-normal" href="#">Marketplace</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span className="text-sm font-medium">Logout</span>
          </button>
          <div className="h-8 w-8 rounded-full bg-[#2bee79]/20 flex items-center justify-center text-[#2bee79] font-bold">
            {user?.email?.[0].toUpperCase()}
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[1440px] mx-auto px-6 md:px-10 py-6">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 mb-6 text-sm">
          <Link className="text-slate-500 hover:text-[#2bee79] transition-colors" href="/dashboard">Dashboard</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-500">Projects</span>
          <span className="text-slate-400">/</span>
          <span className="text-slate-900 dark:text-slate-100 font-medium">{project.name}</span>
        </nav>

        {/* Project Header Card */}
        <div className="bg-white dark:bg-[#152e20] rounded-xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">{project.name}</h1>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#2bee79]/10 text-[#2bee79] border border-[#2bee79]/20">
                  <span className="material-symbols-outlined text-sm mr-1">verified</span>
                  {project.project_stage.replace('_', ' ')}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400 text-sm md:text-base">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">bolt</span>
                  {project.project_size_mw} MW Capacity
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">location_on</span>
                  {project.location_country}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">monetization_on</span>
                  ${(project.capital_required / 1000000).toFixed(1)}M Capital Req.
                </span>
              </div>
            </div>
            <div className="flex gap-3 self-start">
              <Button variant="outline" className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                Share
              </Button>
              <Button className="bg-[#2bee79] hover:bg-[#2bee79]/90 text-slate-900 font-bold shadow-sm shadow-[#2bee79]/30">
                Update Status
              </Button>
            </div>
          </div>

          {/* Deal Stepper */}
          <div className="mt-10 relative px-4">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800 -translate-y-1/2 rounded-full -z-10"></div>
            <div 
              className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-[#2bee79] to-blue-400 -translate-y-1/2 rounded-full -z-10 transition-all duration-500"
              style={{ width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%` }}
            ></div>
            <div className="flex justify-between w-full">
              {steps.map((step, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isActive = idx === currentStepIndex;
                
                return (
                  <div key={step.status} className="flex flex-col items-center gap-2 relative">
                    {isActive && (
                      <div className="absolute -inset-4 bg-blue-400/20 rounded-full blur-xl animate-pulse"></div>
                    )}
                    <div className={`
                      relative w-8 h-8 rounded-full flex items-center justify-center shadow-sm ring-4 ring-white dark:ring-[#152e20]
                      ${isCompleted ? 'bg-[#2bee79] text-slate-900' : ''}
                      ${isActive ? 'bg-blue-400 text-white border-2 border-blue-500' : ''}
                      ${!isCompleted && !isActive ? 'bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-400' : ''}
                    `}>
                      {isCompleted ? (
                        <span className="material-symbols-outlined text-lg font-bold">check</span>
                      ) : isActive ? (
                        <span className="material-symbols-outlined animate-spin text-lg" style={{ animationDuration: '3s' }}>sync</span>
                      ) : (
                        <span className="text-xs font-bold">{idx + 1}</span>
                      )}
                    </div>
                    <span className={`text-[10px] md:text-xs font-semibold whitespace-nowrap
                      ${isCompleted || isActive ? 'text-[#2bee79] dark:text-[#2bee79]' : 'text-slate-400'}
                      ${isActive ? 'text-blue-500 dark:text-blue-400 font-bold' : ''}
                    `}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Split Pane Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[600px]">
          {/* Left Pane: Secure Messaging */}
          <section className="lg:col-span-7 flex flex-col bg-white dark:bg-[#152e20] rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500">forum</span>
                Secure Messaging
              </h3>
              <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">End-to-End Encrypted</span>
            </div>
            
            {/* Message History */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/30 dark:bg-[#12281c] max-h-[400px]">
              {!engagement ? (
                <div className="flex h-full items-center justify-center text-slate-500 text-sm">
                  No active engagement for this project yet.
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-500 text-sm italic">
                  Start the conversation...
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex gap-4 max-w-[85%] ${isOwn ? 'ml-auto flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                        ${isOwn ? 'bg-[#2bee79]/20 text-[#2bee79]' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}
                      `}>
                        {msg.sender?.email?.[0].toUpperCase()}
                      </div>
                      <div className={`flex flex-col gap-1 ${isOwn ? 'items-end' : ''}`}>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-200">
                            {isOwn ? 'You' : 'Partner'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className={`p-3 rounded-xl border shadow-sm text-sm leading-relaxed
                          ${isOwn 
                            ? 'bg-[#2bee79]/10 border-[#2bee79]/20 text-slate-800 dark:text-slate-200 rounded-tr-none' 
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-tl-none'}
                        `}>
                          {msg.message_body}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-[#152e20] border-t border-slate-100 dark:border-slate-800">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <button className="p-2 text-slate-400 hover:text-[#2bee79] transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" type="button">
                  <span className="material-symbols-outlined">attach_file</span>
                </button>
                <input 
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border-none rounded-lg px-4 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#2bee79]/50 outline-none" 
                  placeholder="Type your message..." 
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  disabled={!engagement || isSending}
                />
                <Button 
                  disabled={!engagement || isSending || !newMessage.trim()}
                  className="bg-[#2bee79] hover:bg-[#2bee79]/90 text-slate-900 rounded-lg transition-colors flex items-center justify-center px-4 font-semibold" 
                  type="submit"
                >
                  {isSending ? <Icons.spinner className="h-4 w-4 animate-spin" /> : <span className="material-symbols-outlined text-lg mr-1">send</span>}
                  Send
                </Button>
              </form>
            </div>
          </section>

          {/* Right Pane: Due Diligence Documents */}
          <section className="lg:col-span-5 flex flex-col bg-white dark:bg-[#152e20] rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500">folder_open</span>
                Due Diligence Docs
              </h3>
              <button className="text-sm font-medium text-[#2bee79] hover:text-[#2bee79]/80 transition-colors">Download All</button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <ul className="flex flex-col gap-2">
                {/* Placeholder documents based on design */}
                <li className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 flex-shrink-0">
                      <span className="material-symbols-outlined">picture_as_pdf</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Environmental Impact Assessment.pdf</span>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>2.4 MB</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-400"></span>
                        <span>Uploaded Oct 14</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-slate-300 group-hover:text-[#2bee79] transition-colors p-1">
                    <span className="material-symbols-outlined">download</span>
                  </button>
                </li>
                
                <li className="group flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 flex-shrink-0">
                      <span className="material-symbols-outlined">table_view</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Financial Model_v3.xlsx</span>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>1.1 MB</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-slate-400"></span>
                        <span>Uploaded Oct 15</span>
                      </div>
                    </div>
                  </div>
                  <button className="text-slate-300 group-hover:text-[#2bee79] transition-colors p-1">
                    <span className="material-symbols-outlined">download</span>
                  </button>
                </li>

                <div className="mt-4 p-4 rounded-lg bg-[#2bee79]/5 border border-dashed border-[#2bee79]/30 flex flex-col items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[#2bee79]">upload_file</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Drag and drop more documents here</p>
                  <Button variant="link" className="text-[#2bee79] text-xs h-auto p-0">Browse Files</Button>
                </div>
              </ul>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
