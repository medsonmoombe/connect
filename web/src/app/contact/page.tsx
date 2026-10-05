'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Icons, Send, CheckCircle2, Globe, Mail, Phone, MapPin } from '@/components/ui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PublicNavbar } from '@/components/marketing/PublicNavbar';
import { PublicFooter } from '@/components/marketing/PublicFooter';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1500);
  };

  if (submitted) {
    return (
      <div className="h-full overflow-y-auto bg-[#f5f6f3] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-100 flex items-center justify-center text-green-700 mb-8 animate-in zoom-in duration-500">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Message Received</h1>
        <p className="text-slate-500 max-w-md mb-10 leading-relaxed font-medium">
          Our Strategy Team has been notified. We will review your inquiry and get back to you within 24-48 business hours.
        </p>
        <Link href="/">
          <Button className="bg-[#052e1a] hover:bg-green-800 text-white h-11 px-8 font-semibold text-sm transition-colors duration-200">
            Return to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f3] font-sans selection:bg-green-100 selection:text-green-900">
      <PublicNavbar />

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-20 items-start">
            {/* Left Side: Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-100 text-green-800 text-[10px] font-bold uppercase tracking-widest mb-8">
                <Globe className="w-3.5 h-3.5" />
                Strategy Team
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 leading-tight mb-8">
                Let&apos;s scale your <br />
                <span className="text-green-800">infrastructure impact.</span>
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed mb-12 font-medium max-w-md">
                Whether you&apos;re a developer seeking capital or an investor looking for verified deal flow, our team is here to facilitate the connection.
              </p>

              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="w-12 h-12 bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                    <Mail className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">Email Us</h4>
                    <p className="text-sm text-slate-500">strategy@africonnect.io</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                    <Phone className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 mb-1">Call Us</h4>
                    <p className="text-sm text-slate-500">+44 20 7946 0123</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-12 h-12 bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
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
            <div className="bg-white border border-slate-200 p-8 md:p-10 shadow-[0_20px_60px_rgba(15,23,42,0.06)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-50 -z-10 opacity-50"></div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Send a Message</p>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-900">Contact our Strategy Team</h2>
                  <p className="mt-1.5 text-sm text-slate-400 font-normal">We typically respond within 24-48 business hours.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name" className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">First Name</Label>
                    <Input id="first_name" placeholder="Jane" required className="h-11 rounded-none border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name" className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Last Name</Label>
                    <Input id="last_name" placeholder="Doe" required className="h-11 rounded-none border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Work Email</Label>
                  <Input id="email" type="email" placeholder="jane@company.com" required className="h-11 rounded-none border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="organization" className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Organization</Label>
                  <Input id="organization" placeholder="Infrastructure Dev Co." required className="h-11 rounded-none border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-300 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">How can we help?</Label>
                  <textarea
                    id="message"
                    rows={4}
                    required
                    className="w-full rounded-none border border-slate-200 bg-slate-50 p-4 focus:border-[#052e1a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e1a]/8 text-sm transition-all placeholder:text-slate-300"
                    placeholder="Tell us about your project or investment criteria..."
                  ></textarea>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-[#052e1a] hover:bg-green-800 text-white text-sm font-semibold rounded-none shadow-none transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Icons.spinner className="size-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send Inquiry</span>
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  Protected by enterprise-grade encryption and KYC/KYB verification.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
