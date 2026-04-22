'use client';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-20 px-6 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-12 rounded-[40px] shadow-xl border border-slate-100">
        <h1 className="text-4xl font-black text-slate-900 mb-8">Privacy Policy</h1>
        <div className="space-y-6 text-slate-600 leading-relaxed">
          <p className="font-bold">Effective Date: April 19, 2026</p>
          <p>At Afri Connect, we take the security and confidentiality of your energy infrastructure data with extreme seriousness.</p>
          <h2 className="text-xl font-bold text-slate-900 pt-4">1. Data Collection</h2>
          <p>We collect technical project data, financial models, and corporate documentation for the sole purpose of matching you with verified capital and technical partners.</p>
          <h2 className="text-xl font-bold text-slate-900 pt-4">2. Secure Data Room</h2>
          <p>Documents uploaded to the Virtual Data Room (VDR) are encrypted at rest and in transit. Access is restricted by a strict NDA-based gatekeeping mechanism.</p>
          <h2 className="text-xl font-bold text-slate-900 pt-4">3. Third-Party Sharing</h2>
          <p>We do not sell your data. Data is only shared with counterparties after an explicit "Express Interest" action and, where applicable, the countersigning of a digital NDA.</p>
        </div>
      </div>
    </div>
  );
}
