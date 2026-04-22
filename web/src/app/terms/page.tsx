'use client';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-12 rounded-[40px] shadow-xl border border-slate-100">
        <h1 className="text-4xl font-black text-slate-900 mb-8">Terms of Service</h1>
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <p className="font-bold">Last Updated: April 19, 2026</p>
          <p>By accessing the Afri Connect platform, you agree to the following terms regarding the matching and financing of infrastructure projects.</p>
          <h2 className="text-xl font-bold text-slate-900 pt-4">1. Eligibility</h2>
          <p>This platform is intended for institutional investors, professional energy developers, and verified technical service providers (EPCs/O&M).</p>
          <h2 className="text-xl font-bold text-slate-900 pt-4">2. Non-Circumvention</h2>
          <p>Users agree not to circumvent the platform to close deals with identified counterparties without proper disclosure to the platform administrators.</p>
          <h2 className="text-xl font-bold text-slate-900 pt-4">3. AI Scoring Fallibility</h2>
          <p>While our AI scoring provides deep insights, it should not be considered final investment advice. All partners must conduct their own due diligence.</p>
        </div>
      </div>
    </div>
  );
}
