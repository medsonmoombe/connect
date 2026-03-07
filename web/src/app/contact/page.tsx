'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icons, ArrowLeft, Send, CheckCircle2, Globe, Mail, Phone, MapPin } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-700 mb-8 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Message Received</h1>
        <p className="text-slate-500 max-w-md mb-10 leading-relaxed font-medium">
          Our Strategy Team has been notified. We'll review your inquiry and get back to you within 24-48 business hours.
        </p>
        <Link href="/">
          <Button className="bg-green-800 hover:bg-green-700 text-white rounded-full px-10">
            Return to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-green-100 selection:text-green-900">
      {/* Texture Overlay */}
      <div className="fixed inset-0 texture-overlay opacity-[0.03] pointer-events-none z-[100]"></div>

      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 text-green-700">
              <Icons.logo className="w-full h-full" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Afri <span className="text-green-700 font-extrabold tracking-tighter">Connect</span>
            </span>
          </Link>
          
          <Link href="/" className="text-[12px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 hover:text-green-700 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-start">
            {/* Left Side: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-100 text-green-800 text-[10px] font-bold uppercase tracking-widest mb-8">
                <Globe className="w-3.5 h-3.5" />
                Strategy Team
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-8">
                Let's scale your <br />
                <span className="text-green-800">infrastructure impact.</span>
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed mb-12 font-medium max-w-md">
                Whether you're a developer seeking capital or an investor looking for verified deal flow, our team is here to facilitate the connection.
              </p>

              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100">
                    <Mail className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">Email Us</h4>
                    <p className="text-sm text-slate-500">strategy@africonnect.io</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100">
                    <Phone className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">Call Us</h4>
                    <p className="text-sm text-slate-500">+44 20 7946 0123</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100">
                    <MapPin className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">Global Office</h4>
                    <p className="text-sm text-slate-500">85 Great Portland Street, London, UK</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Side: Form */}
            <div className="bg-white border border-slate-200 rounded-[32px] p-8 md:p-10 shadow-xl shadow-slate-200/40 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 rounded-bl-[100px] -z-10 opacity-50"></div>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-xs font-bold uppercase tracking-wider text-slate-500">First Name</Label>
                    <Input id="first_name" placeholder="Jane" required className="h-12 rounded-xl border-slate-200 focus:ring-green-600 focus:border-green-600" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-xs font-bold uppercase tracking-wider text-slate-500">Last Name</Label>
                    <Input id="last_name" placeholder="Doe" required className="h-12 rounded-xl border-slate-200 focus:ring-green-600 focus:border-green-600" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Work Email</Label>
                  <Input id="email" type="email" placeholder="jane@company.com" required className="h-12 rounded-xl border-slate-200 focus:ring-green-600 focus:border-green-600" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organization" className="text-xs font-bold uppercase tracking-wider text-slate-500">Organization</Label>
                  <Input id="organization" placeholder="Infrastructure Dev Co." required className="h-12 rounded-xl border-slate-200 focus:ring-green-600 focus:border-green-600" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-xs font-bold uppercase tracking-wider text-slate-500">How can we help?</Label>
                  <textarea 
                    id="message" 
                    rows={4} 
                    required
                    className="w-full rounded-xl border border-slate-200 p-4 focus:ring-2 focus:ring-green-600 focus:border-green-600 outline-none text-sm transition-all placeholder:text-slate-400"
                    placeholder="Tell us about your project or investment criteria..."
                  ></textarea>
                </div>

                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white h-14 rounded-xl font-bold text-base flex items-center justify-center gap-2 group transition-all"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Send Inquiry
                      <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </>
                  )}
                </Button>
                
                <p className="text-[10px] text-center text-slate-400 font-medium">
                  By submitting this form, you agree to our Privacy Policy and Terms of Service.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer (Simplified) */}
      <footer className="py-12 border-t border-slate-100 text-center">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
          © 2026 Afri Connect Ltd. · The Intelligence Layer for African Infrastructure
        </p>
      </footer>
    </div>
  );
}
