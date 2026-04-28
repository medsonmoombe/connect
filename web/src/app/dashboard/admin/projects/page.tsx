'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { projectsApi } from '@/services/api';
import { Project, ProjectStage } from '@/types';
import Link from 'next/link';

const STAGES: { id: string, name: string }[] = [
  { id: 'ALL', name: 'All Stages' },
  { id: 'CONCEPT', name: 'Concept' },
  { id: 'FEASIBILITY', name: 'Feasibility' },
  { id: 'PRE_CONSTRUCTION', name: 'Pre-Construction' },
  { id: 'READY_TO_BUILD', name: 'Ready to Build' },
  { id: 'UNDER_CONSTRUCTION', name: 'Under Construction' },
  { id: 'OPERATIONAL', name: 'Operational' },
];

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetchProjects();
  }, [statusFilter]);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const response = await projectsApi.getAdminAll({
        search: search || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      if (response.data) {
        setProjects(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProjects();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStageColor = (stage: ProjectStage) => {
    switch (stage) {
      case 'CONCEPT': return 'bg-slate-50 text-slate-700 border-slate-100';
      case 'FEASIBILITY': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'PRE_CONSTRUCTION': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'READY_TO_BUILD': return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'UNDER_CONSTRUCTION': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'OPERATIONAL': return 'bg-green-50 text-green-700 border-green-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Project Oversight</h2>
          <p className="text-slate-500">
            Monitor and manage all energy projects across the platform.
          </p>
        </div>
        <Button className="bg-green-800 hover:bg-green-700 text-white rounded-xl h-11 px-6 shadow-lg shadow-green-900/20">
          <Icons.plus className="mr-2 size-4" />
          Create Project
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search projects by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-slate-200 focus:ring-green-800/20"
          />
        </form>
        <div className="flex gap-4">
          <div className="relative min-w-[180px]">
            <Icons.filter className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20 appearance-none"
            >
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          </div>
          <Button 
            variant="outline" 
            className="h-11 px-6 rounded-xl border-slate-200 text-slate-600"
            onClick={fetchProjects}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Project Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Developer</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Capital Required</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Created</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-100 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-20 bg-slate-100 rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-8 w-16 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icons.folder className="size-12 text-slate-300" />
                      <p className="text-slate-500 font-medium">No projects found matching your criteria.</p>
                      <Button 
                        variant="link" 
                        className="text-green-800"
                        onClick={() => {
                          setSearch('');
                          setStatusFilter('ALL');
                        }}
                      >
                        Clear all filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{project.name}</span>
                        <span className="text-xs text-slate-500">{project.technology_type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{project.developer?.name || 'N/A'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStageColor(project.project_stage)}`}>
                        {project.project_stage.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(project.capital_required)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500">
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-green-800 hover:text-green-900 hover:bg-green-50 font-semibold">
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Showing {projects.length} projects</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg disabled:opacity-50" disabled>Previous</Button>
            <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg disabled:opacity-50" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
