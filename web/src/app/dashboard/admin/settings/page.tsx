'use client';

import { useState } from 'react';
import { Icons } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">System Settings</h2>
        <p className="text-slate-500">Configure platform-wide parameters and governance rules.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* General Config */}
          <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
              <Icons.settings className="size-4 text-green-800" />
              General Configuration
            </h3>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="platformName">Platform Name</Label>
                  <Input id="platformName" defaultValue="Afri Connect" className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input id="supportEmail" defaultValue="ops@africonnect.energy" className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Base Currency Label</Label>
                <Input id="currency" defaultValue="ZMW / USD" className="rounded-xl" />
              </div>
            </div>
          </div>

          {/* AI Scoring Config */}
          <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
              <Icons.zap className="size-4 text-green-800" />
              AI Scoring Weights
            </h3>
            
            <div className="space-y-6">
              <WeightSlider label="Regulatory & Readiness" value={40} />
              <WeightSlider label="Financial Viability" value={35} />
              <WeightSlider label="Developer Strength" value={25} />
              
              <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                 <div className="flex flex-col">
                   <span className="text-sm font-bold text-slate-900">Auto-trigger Analysis</span>
                   <span className="text-xs text-slate-400">Run Gemini analysis immediately upon document upload</span>
                 </div>
                 <input type="checkbox" defaultChecked className="size-5 accent-green-800" />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
           <div className="p-8 bg-slate-900 rounded-[32px] text-white shadow-2xl">
              <Icons.shieldCheck className="size-8 text-green-400 mb-6" />
              <h3 className="text-xl font-bold mb-2">Security Override</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-8">Force platform-wide maintenance mode or restrict new signups.</p>
              <Button className="w-full bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold py-6">
                 ENABLE MAINTENANCE
              </Button>
           </div>

           <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/40">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Environment</h3>
              <div className="space-y-4">
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase">Version</span>
                    <span className="text-slate-900 font-mono">v1.2.4-MVP</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase">Region</span>
                    <span className="text-slate-900 font-mono">af-south-1</span>
                 </div>
                 <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase">Node</span>
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md font-mono">PRODUCTION</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <div className="flex justify-end pt-8">
        <Button className="bg-green-800 text-white rounded-xl px-12 h-14 font-black shadow-xl hover:scale-105 transition-all">
          SAVE GLOBAL SETTINGS
        </Button>
      </div>
    </div>
  );
}

function WeightSlider({ label, value }: { label: string, value: number }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">{label}</span>
        <span className="text-sm font-black text-green-800">{value}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="bg-green-800 h-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
