'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { companiesApi } from '@/services/api';
import { Company, CompanyType } from '@/types';
import Link from 'next/link';

const COMPANY_TYPES: { id: string, name: string }[] = [
  { id: 'ALL', name: 'All Types' },
  { id: 'DEVELOPER', name: 'Developer' },
  { id: 'CAPITAL', name: 'Capital Partner' },
  { id: 'TECHNICAL', name: 'Technical Partner' },
  { id: 'GRANT', name: 'Grant Provider' },
];

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    fetchCompanies();
  }, [typeFilter]);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const response = await companiesApi.getAdminAll({
        search: search || undefined,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
      });
      if (response.data) {
        setCompanies(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCompanies();
  };

  const getTypeColor = (type: CompanyType) => {
    switch (type) {
      case 'DEVELOPER': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'CAPITAL': return 'bg-green-50 text-green-700 border-green-100';
      case 'TECHNICAL': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'GRANT': return 'bg-orange-50 text-orange-700 border-orange-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Company Directory</h2>
          <p className="text-slate-500">
            Overview of all registered companies on the platform.
          </p>
        </div>
        <Button className="bg-green-800 hover:bg-green-700 text-white rounded-xl h-11 px-6 shadow-lg shadow-green-900/20">
          <Icons.plus className="mr-2 size-4" />
          Add Company
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <form onSubmit={handleSearch} className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="Search companies by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl border-slate-200 focus:ring-green-800/20"
          />
        </form>
        <div className="flex gap-4">
          <div className="relative min-w-[180px]">
            <Icons.briefcase className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-800/20 appearance-none"
            >
              {COMPANY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <Icons.chevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          </div>
          <Button 
            variant="outline" 
            className="h-11 px-6 rounded-xl border-slate-200 text-slate-600"
            onClick={fetchCompanies}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Company Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Team Size</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-32 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-24 bg-slate-100 rounded-full" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-slate-100 rounded" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-12 bg-slate-100 rounded ml-auto" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-20 bg-slate-100 rounded-full" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-8 w-16 bg-slate-100 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Icons.briefcase className="size-12 text-slate-300" />
                      <p className="text-slate-500 font-medium">No companies found matching your criteria.</p>
                      <Button 
                        variant="link" 
                        className="text-green-800"
                        onClick={() => {
                          setSearch('');
                          setTypeFilter('ALL');
                        }}
                      >
                        Clear all filters
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-slate-400 text-xs shrink-0">
                          {company.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">{company.name}</span>
                          <span className="text-xs text-slate-500">{company.website || 'No website'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTypeColor(company.type)}`}>
                        {company.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">{company.country}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm text-slate-900">{company.team_size}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                        Active
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="h-8 px-3 rounded-lg text-green-800 hover:text-green-900 hover:bg-green-50 font-semibold">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Showing {companies.length} companies</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg disabled:opacity-50" disabled>Previous</Button>
            <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg disabled:opacity-50" disabled>Next</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
