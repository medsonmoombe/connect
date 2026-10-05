'use client';

import React from 'react';
import { Company } from '@/types';
import { Mail, Phone, Globe, MapPin, Building2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  company: Company;
  isVisible: boolean;
  className?: string;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  company,
  isVisible,
  className,
}) => {
  if (!isVisible) {
    return (
      <div className={cn("p-6 bg-slate-50 border border-dashed border-slate-200 rounded-none text-center", className)}>
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-slate-100 rounded-none text-slate-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>
        <h4 className="text-xs font-bold text-slate-700 mb-1">Contact Information Locked</h4>
        <p className="text-[10px] text-slate-500 font-medium max-w-xs mx-auto">
          Mutual acceptance of the introduction is required to reveal contact details.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("bg-white border border-slate-100 rounded-none overflow-hidden shadow-sm", className)}>
      <div className="bg-primary px-5 py-3 flex items-center justify-between">
        <h3 className="text-white font-bold text-sm">{company.name}</h3>
        <span className="bg-white/20 text-white text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Verified</span>
      </div>
      
      <div className="p-5 space-y-3">
        {company.description && (
          <p className="text-xs text-slate-500 line-clamp-2 italic leading-relaxed">
            "{company.description}"
          </p>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center text-xs text-slate-600">
            <Mail className="w-3.5 h-3.5 mr-2.5 text-primary" />
            <a href={`mailto:info@${company.name.toLowerCase().replace(/\s/g, '')}.com`} className="hover:text-primary hover:underline font-medium">
              info@company.com
            </a>
          </div>

          <div className="flex items-center text-xs text-slate-600">
            <Phone className="w-3.5 h-3.5 mr-2.5 text-primary" />
            <span className="font-medium">+1 (555) 000-0000</span>
          </div>

          <div className="flex items-center text-xs text-slate-600">
            <MapPin className="w-3.5 h-3.5 mr-2.5 text-primary" />
            <span className="font-medium">{company.country}</span>
          </div>

          {company.website && (
            <div className="flex items-center text-xs text-slate-600">
              <Globe className="w-3.5 h-3.5 mr-2.5 text-primary" />
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline font-medium">
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
          <div className="text-center p-2 bg-slate-50 rounded-none">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Team Size</p>
            <p className="text-xs font-bold text-slate-900">{company.team_size}+</p>
          </div>
          <div className="text-center p-2 bg-slate-50 rounded-none">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Since</p>
            <p className="text-xs font-bold text-slate-900">{new Date().getFullYear() - company.years_operating}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
