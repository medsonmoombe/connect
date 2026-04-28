'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usersApi, projectsApi, auditLogsApi } from '@/services/api';
import { projectService } from '@/services/projects';
import { User, Project } from '@/types';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export default function VerificationQueuePage() {
  const [activeQueue, setActiveQueue] = useState<'USERS' | 'PROJECTS'>('USERS');
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchQueues();
  }, []);

  const fetchQueues = async () => {
    setLoading(true);
    try {
      const [usersRes, projectsRes] = await Promise.all([
        usersApi.getPendingVerifications(),
        projectsApi.getAdminAll({ status: 'FEASIBILITY' }) // Assuming FEASIBILITY is the 'submitted' stage for MVP
      ]);
      setPendingUsers(usersRes.data || []);
      setPendingProjects(projectsRes.data || []);
      
      if (usersRes.data && usersRes.data.length > 0) setSelectedUser(usersRes.data[0]);
      if (projectsRes.data && projectsRes.data.length > 0) setSelectedProject(projectsRes.data[0]);
    } catch (error) {
      console.error('Error fetching queues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (userId: string, status: 'VERIFIED' | 'REJECTED') => {
    setProcessing(true);
    try {
      await usersApi.verifyUser(userId, status);
      await auditLogsApi.create({
        user_id: currentUser?.id,
        action_type: status === 'VERIFIED' ? 'USER_VERIFIED' : 'USER_REJECTED',
        entity_type: 'USER',
        entity_id: userId
      });
      const updated = pendingUsers.filter(u => u.id !== userId);
      setPendingUsers(updated);
      setSelectedUser(updated.length > 0 ? updated[0] : null);
    } catch (error) {
      console.error('Error verifying user:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleValidateProject = async (projectId: string, status: 'VALIDATED' | 'REJECTED') => {
    setProcessing(true);
    try {
      if (status === 'VALIDATED') {
        // Transition project stage to PRE_CONSTRUCTION as 'validated'
        await projectService.updateProject(projectId, { project_stage: 'PRE_CONSTRUCTION' });
        // Trigger matching
        await projectService.runMatchingEngine(projectId);
      } else {
        // Handle rejection - maybe just delete or flag? For now just remove from queue
      }
      
      await auditLogsApi.create({
        user_id: currentUser?.id,
        action_type: status === 'VALIDATED' ? 'PROJECT_VALIDATED' : 'PROJECT_REJECTED',
        entity_type: 'PROJECT',
        entity_id: projectId
      });

      const updated = pendingProjects.filter(p => p.id !== projectId);
      setPendingProjects(updated);
      setSelectedProject(updated.length > 0 ? updated[0] : null);
    } catch (error) {
      console.error('Error validating project:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center bg-slate-50/50 rounded-[40px]">
        <Icons.spinner className="size-8 animate-spin text-green-800" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Queue Selector */}
      <div className="flex gap-4 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm w-fit">
        <button 
          onClick={() => setActiveQueue('USERS')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
            activeQueue === 'USERS' ? "bg-green-800 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Icons.user className="size-3.5" />
          USERS ({pendingUsers.length})
        </button>
        <button 
          onClick={() => setActiveQueue('PROJECTS')}
          className={cn(
            "px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
            activeQueue === 'PROJECTS' ? "bg-green-800 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <Icons.zap className="size-3.5" />
          PROJECTS ({pendingProjects.length})
        </button>
      </div>

      <div className="flex gap-8 h-[calc(100vh-280px)] animate-in fade-in duration-700">
        {/* Queue Sidebar */}
        <div className="w-1/3 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">
              {activeQueue === 'USERS' ? 'User Applications' : 'Project Submissions'}
            </h3>
          </div>
          <div className="flex-grow overflow-y-auto no-scrollbar divide-y divide-slate-50">
            {activeQueue === 'USERS' ? (
              pendingUsers.length > 0 ? pendingUsers.map((u) => (
                <div 
                  key={u.id} 
                  onClick={() => setSelectedUser(u)}
                  className={cn(
                    "p-6 cursor-pointer transition-all hover:bg-slate-50 flex items-center gap-4",
                    selectedUser?.id === u.id ? "bg-slate-50 border-l-4 border-green-800" : ""
                  )}
                >
                  <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">{u.full_name?.substring(0, 2).toUpperCase()}</div>
                  <div className="min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{u.full_name}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{u.role}</p></div>
                </div>
              )) : <div className="p-12 text-center text-slate-400 italic text-sm">No pending users.</div>
            ) : (
              pendingProjects.length > 0 ? pendingProjects.map((p) => (
                <div 
                  key={p.id} 
                  onClick={() => setSelectedProject(p)}
                  className={cn(
                    "p-6 cursor-pointer transition-all hover:bg-slate-50 flex items-center gap-4",
                    selectedProject?.id === p.id ? "bg-slate-50 border-l-4 border-green-800" : ""
                  )}
                >
                  <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0"><Icons.zap className="size-5" /></div>
                  <div className="min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{p.name}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">{p.technology_type} • {p.location_country}</p></div>
                </div>
              )) : <div className="p-12 text-center text-slate-400 italic text-sm">No pending projects.</div>
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="flex-grow bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col overflow-hidden">
          {activeQueue === 'USERS' && selectedUser ? (
            <>
              <div className="p-10 border-b border-slate-50">
                <div className="flex items-center gap-6 mb-8">
                  <div className="size-20 rounded-[28px] bg-slate-100 flex items-center justify-center text-slate-400 font-black text-2xl shadow-inner">{selectedUser.full_name?.substring(0, 2).toUpperCase()}</div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedUser.full_name}</h2>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Company</p><p className="text-lg font-bold text-slate-900">{(selectedUser as any).company?.name || selectedUser.company_id || 'N/A'}</p></div>
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Role Applied</p><p className="text-lg font-bold text-slate-900">{selectedUser.role}</p></div>
                </div>
              </div>
              <div className="p-10 flex-grow">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6">Verification Documents</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3"><Icons.fileText className="size-4 text-slate-400" /><span className="text-xs font-bold text-slate-600">KYC_PROFILE.PDF</span></div>
                    <Button variant="ghost" size="sm" className="text-green-800 font-black text-[10px] uppercase">VIEW</Button>
                  </div>
                </div>
              </div>
              <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                <div className="flex gap-4">
                  <Button onClick={() => handleVerifyUser(selectedUser.id, 'REJECTED')} disabled={processing} variant="outline" className="h-12 px-8 rounded-xl border-slate-200 text-red-600 font-bold">REJECT</Button>
                  <Button onClick={() => handleVerifyUser(selectedUser.id, 'VERIFIED')} disabled={processing} className="h-12 px-10 rounded-xl bg-green-800 text-white font-bold shadow-xl">APPROVE</Button>
                </div>
              </div>
            </>
          ) : activeQueue === 'PROJECTS' && selectedProject ? (
            <>
              <div className="p-10 border-b border-slate-50">
                <div className="flex items-center gap-6 mb-8">
                  <div className="size-20 rounded-[28px] bg-green-50 flex items-center justify-center text-green-800 font-black text-2xl shadow-inner"><Icons.zap className="size-10" /></div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedProject.name}</h2>
                    <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1">{selectedProject.technology_type} • {selectedProject.project_size_mw} MW</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-8">
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Developer</p><p className="text-lg font-bold text-slate-900">{selectedProject.developer?.name}</p></div>
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Capital Required</p><p className="text-lg font-bold text-slate-900">${(selectedProject.capital_required / 1000000).toFixed(1)}M</p></div>
                </div>
              </div>
              <div className="p-10 flex-grow">
                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6">Data Room Contents</h4>
                <div className="space-y-4">
                  {selectedProject.documents?.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3"><Icons.fileText className="size-4 text-slate-400" /><span className="text-xs font-bold text-slate-600 uppercase">{doc.document_type}</span></div>
                      <Link href={doc.file_url} target="_blank"><Button variant="ghost" size="sm" className="text-green-800 font-black text-[10px] uppercase">REVIEW</Button></Link>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-8 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                <div className="flex gap-4">
                  <Button onClick={() => handleValidateProject(selectedProject.id, 'REJECTED')} disabled={processing} variant="outline" className="h-12 px-8 rounded-xl border-slate-200 text-red-600 font-bold">REJECT SUBMISSION</Button>
                  <Button onClick={() => handleValidateProject(selectedProject.id, 'VALIDATED')} disabled={processing} className="h-12 px-10 rounded-xl bg-green-800 text-white font-bold shadow-xl">VALIDATE & PUBLISH</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <Icons.shieldCheck className="size-20 text-slate-100 mb-6" />
              <h3 className="text-xl font-bold text-slate-400">Select an item to review</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
