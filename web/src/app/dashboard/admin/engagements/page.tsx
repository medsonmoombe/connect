'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Engagement } from '@/types';
import { getStateLabel, getStateProgress } from '@/lib/engagement';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminEngagementsPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEngagements() {
      try {
        const { data, error } = await supabase
          .from('engagements')
          .select(`
            *,
            project:projects(name, developer:companies(name))
          `)
          .order('updated_at', { ascending: false });

        if (error) throw error;
        setEngagements(data || []);
      } catch (err) {
        console.error('Error fetching engagements:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchEngagements();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Engagement Pipeline</h1>
          <p className="text-slate-500">Monitor active partnerships and project milestones across the platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium mb-1">Active Engagements</p>
          <p className="text-2xl font-bold text-slate-900">{engagements.filter(e => e.status !== 'DROPPED' && e.status !== 'CLOSED').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium mb-1">Closed Deals</p>
          <p className="text-2xl font-bold text-green-600">{engagements.filter(e => e.status === 'CLOSED').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-sm text-slate-500 font-medium mb-1">Average Progress</p>
          <p className="text-2xl font-bold text-blue-600">
            {engagements.length > 0 
              ? Math.round(engagements.reduce((acc, e) => acc + getStateProgress(e.status), 0) / engagements.length) 
              : 0}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Project</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Developer</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Milestone Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Progress</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Last Activity</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Icons.spinner className="size-6 animate-spin mx-auto text-green-800" />
                </td>
              </tr>
            ) : engagements.length > 0 ? (
              engagements.map((eng) => (
                <tr key={eng.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-900">{eng.project?.name || 'Unknown Project'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-600">{(eng.project as any)?.developer?.name || 'Unknown Developer'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                      eng.status === 'CLOSED' ? "bg-green-100 text-green-800" :
                      eng.status === 'DROPPED' ? "bg-red-100 text-red-800" :
                      "bg-blue-100 text-blue-800"
                    )}>
                      {getStateLabel(eng.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full transition-all",
                            eng.status === 'CLOSED' ? "bg-green-600" : "bg-blue-600"
                          )} 
                          style={{ width: `${getStateProgress(eng.status)}%` }} 
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-500">{getStateProgress(eng.status)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-400">{new Date(eng.updated_at || eng.created_at).toLocaleDateString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/engagements/${eng.id}`}>
                      <button className="text-green-800 hover:text-green-900 text-sm font-bold">Monitor</button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">No engagements found in the system.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
