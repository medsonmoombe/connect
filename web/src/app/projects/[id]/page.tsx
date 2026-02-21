'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

export default function ProjectDetailsPage() {
  const [activeStage, setActiveStage] = useState(3); // Due Diligence

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden">
      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto no-scrollbar">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-gray-100 h-16 px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm font-bold text-text-muted uppercase tracking-widest">
            <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link>
            <Icons.chevronRight className="size-3" />
            <Link href="#" className="hover:text-primary transition-colors">Projects</Link>
            <Icons.chevronRight className="size-3" />
            <span className="text-text-main">Project Helios</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="h-10 px-6 rounded-xl border-gray-200 font-bold text-text-main">Share</Button>
            <Button className="h-10 px-6 bg-primary text-primary-content hover:bg-primary/90 font-bold rounded-xl shadow-lg transition-all">
              Invest Now
            </Button>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="p-10 rounded-3xl bg-surface border border-gray-100 shadow-soft mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-600 border border-green-100 mb-4">
                  <Icons.check className="size-3" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Technical Validation Passed</span>
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-text-main leading-tight mb-4">
                  Project Helios: 50MW Solar Farm
                </h1>
                <div className="flex flex-wrap items-center gap-6 text-sm font-bold text-text-muted uppercase tracking-wider">
                  <span className="flex items-center gap-2"><Icons.zap className="size-4" /> 50 MW Capacity</span>
                  <span className="flex items-center gap-2"><Icons.mapPin className="size-4" /> Lagos, Nigeria</span>
                  <span className="flex items-center gap-2"><Icons.dollar className="size-4" /> $12M Capital Req.</span>
                </div>
              </div>
            </div>

            {/* Workflow Stepper */}
            <div className="relative pt-12 pb-4">
              <div className="absolute top-[4.25rem] left-0 w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-700" 
                  style={{ width: `${(activeStage - 1) * 25}%` }} 
                />
              </div>
              <div className="relative flex justify-between">
                <StepItem number={1} label="Initial Match" status="completed" />
                <StepItem number={2} label="NDA Signed" status="completed" />
                <StepItem number={3} label="Due Diligence" status="active" />
                <StepItem number={4} label="Term Sheet" status="pending" />
                <StepItem number={5} label="Closing" status="pending" />
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Project Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* Data Room / Documents */}
              <div className="p-8 rounded-3xl bg-surface border border-gray-100 shadow-soft">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold text-text-main">Secure Data Room</h3>
                  <Button variant="outline" className="h-9 px-4 text-xs font-bold uppercase tracking-widest rounded-lg border-gray-200">
                    <Icons.download className="size-3 mr-2" /> Download All
                  </Button>
                </div>
                <div className="grid gap-3">
                  <DocumentItem name="Technical_Feasibility_Study.pdf" size="12.4 MB" date="Oct 12, 2023" />
                  <DocumentItem name="Financial_Model_v4.xlsx" size="4.2 MB" date="Oct 15, 2023" />
                  <DocumentItem name="Environmental_Impact_Assessment.pdf" size="8.1 MB" date="Oct 10, 2023" />
                  <DocumentItem name="Grid_Connection_Approval.pdf" size="2.4 MB" date="Nov 2, 2023" />
                </div>
              </div>

              {/* Technical Overview */}
              <div className="p-8 rounded-3xl bg-surface border border-gray-100 shadow-soft">
                <h3 className="text-xl font-bold text-text-main mb-6">Technical Specifications</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
                  <SpecItem label="Technology" value="Solar Photovoltaic" />
                  <SpecItem label="Mounting" value="Single-Axis Tracking" />
                  <SpecItem label="Grid Connection" value="33kV Substation" />
                  <SpecItem label="Inverters" value="Centralized" />
                  <SpecItem label="Expected COD" value="Q4 2025" />
                  <SpecItem label="O&M Partner" value="VoltGrid Services" />
                </div>
              </div>
            </div>

            {/* Engagement Sidebar */}
            <div className="space-y-8">
              {/* Messages / Discussion */}
              <div className="rounded-3xl bg-surface border border-gray-100 shadow-soft overflow-hidden flex flex-col h-[500px]">
                <div className="p-6 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-main uppercase tracking-widest">Secure Messaging</h3>
                    <p className="text-[10px] font-bold text-text-muted mt-1 uppercase">End-to-End Encrypted</p>
                  </div>
                  <Icons.shieldCheck className="size-5 text-primary" />
                </div>
                
                <div className="flex-grow p-6 overflow-y-auto no-scrollbar space-y-6">
                  <div className="text-center">
                    <span className="px-3 py-1 rounded-full bg-gray-50 text-[10px] font-bold text-text-muted uppercase tracking-widest">System: NDA Signed on Oct 12, 2023</span>
                  </div>
                  
                  <MessageBubble 
                    sender="Sarah Jenkins"
                    role="Developer"
                    content="The updated financial model reflects the recent grid connection cost adjustments. Please review v4."
                    time="10:42 AM"
                    isMe={false}
                  />
                  <MessageBubble 
                    sender="Michael Chen"
                    role="Investor"
                    content="Thanks Sarah. Our technical team is reviewing the E&S safeguards today. We should have a response by EOD."
                    time="11:15 AM"
                    isMe={true}
                  />
                </div>

                <div className="p-6 border-t border-gray-50">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Send a message..."
                      className="w-full h-12 bg-background border-none rounded-xl pl-6 pr-14 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg bg-primary text-primary-content flex items-center justify-center shadow-lg">
                      <Icons.send className="size-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Panel */}
              <div className="p-8 rounded-3xl bg-text-main text-white shadow-xl shadow-text-main/20">
                <h3 className="text-lg font-bold mb-4">Ready for Term Sheet?</h3>
                <p className="text-sm text-slate-300 font-medium mb-6 leading-relaxed">
                  Once due diligence is complete, you can generate a structured term sheet based on the platform templates.
                </p>
                <Button className="w-full h-12 rounded-xl bg-primary text-primary-content font-bold hover:scale-105 transition-all">
                  Request Draft Term Sheet
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StepItem({ number, label, status }: { number: number, label: string, status: 'completed' | 'active' | 'pending' }) {
  return (
    <div className="flex flex-col items-center gap-3 z-10">
      <div className={cn(
        "size-10 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all duration-500 shadow-lg",
        status === 'completed' && "bg-primary border-primary text-primary-content",
        status === 'active' && "bg-white border-primary text-primary ring-4 ring-primary/10",
        status === 'pending' && "bg-white border-gray-200 text-text-muted"
      )}>
        {status === 'completed' ? <Icons.check className="size-5" /> : number}
      </div>
      <span className={cn(
        "text-[10px] font-bold uppercase tracking-widest text-center",
        status === 'pending' ? "text-text-muted" : "text-text-main"
      )}>
        {label}
      </span>
    </div>
  );
}

function DocumentItem({ name, size, date }: { name: string, size: string, date: string }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-background border border-gray-50 hover:border-primary/30 group transition-all cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="size-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
          <Icons.fileText className="size-5" />
        </div>
        <div>
          <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{name}</p>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">{size} • {date}</p>
        </div>
      </div>
      <Icons.moreVertical className="size-4 text-text-muted hover:text-text-main" />
    </div>
  );
}

function SpecItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-meta mb-1">{label}</p>
      <p className="text-sm font-bold text-text-main">{value}</p>
    </div>
  );
}

function MessageBubble({ sender, role, content, time, isMe }: { sender: string, role: string, content: string, time: string, isMe: boolean }) {
  return (
    <div className={cn("flex flex-col max-w-[85%]", isMe ? "ml-auto items-end" : "mr-auto items-start")}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-black text-text-main uppercase tracking-widest">{sender}</span>
        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest opacity-60">({role})</span>
      </div>
      <div className={cn(
        "p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm",
        isMe ? "bg-primary text-primary-content rounded-tr-none" : "bg-background text-text-main rounded-tl-none border border-gray-50"
      )}>
        {content}
      </div>
      <span className="text-[10px] font-bold text-text-muted mt-2 uppercase tracking-widest opacity-50">{time}</span>
    </div>
  );
}
