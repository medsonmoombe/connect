'use client';

import React from 'react';
import { Company } from '@/types';
import { Mail, Phone, Globe, MapPin, Building2 } from 'lucide-react';
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
      <div className={cn("p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center", className)}>
        <div className="flex justify-center mb-3">
          <div className="p-3 bg-gray-200 rounded-full text-gray-400">
            <Building2 className="w-8 h-8" />
          </div>
        </div>
        <h4 className="text-sm font-semibold text-gray-900 mb-1">Contact Information Locked</h4>
        <p className="text-xs text-gray-500 max-w-xs mx-auto">
          Mutual acceptance of the introduction is required to reveal contact details and official company profile.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("bg-white border border-blue-100 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md", className)}>
      <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-bold">{company.name}</h3>
        <span className="bg-blue-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase font-medium">Verified Partner</span>
      </div>
      
      <div className="p-6 space-y-4">
        {company.description && (
          <p className="text-sm text-gray-600 line-clamp-3 mb-4 italic">
            "{company.description}"
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center text-sm text-gray-700">
            <Mail className="w-4 h-4 mr-3 text-blue-600" />
            <a href={`mailto:info@${company.name.toLowerCase().replace(/\s/g, '')}.com`} className="hover:text-blue-600 hover:underline">
              info@company.com
            </a>
          </div>

          <div className="flex items-center text-sm text-gray-700">
            <Phone className="w-4 h-4 mr-3 text-blue-600" />
            <span>+1 (555) 000-0000</span>
          </div>

          <div className="flex items-center text-sm text-gray-700">
            <MapPin className="w-4 h-4 mr-3 text-blue-600" />
            <span>{company.country}</span>
          </div>

          {company.website && (
            <div className="flex items-center text-sm text-gray-700">
              <Globe className="w-4 h-4 mr-3 text-blue-600" />
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">
                {company.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100 flex gap-4">
          <div className="text-center flex-1">
            <div className="text-xs text-gray-500 uppercase">Team Size</div>
            <div className="text-sm font-semibold">{company.team_size}+ Experts</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-xs text-gray-500 uppercase">Operating Since</div>
            <div className="text-sm font-semibold">{new Date().getFullYear() - company.years_operating}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
