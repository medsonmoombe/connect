import { PublicNavbar } from '@/components/marketing/PublicNavbar';
import { PublicFooter } from '@/components/marketing/PublicFooter';

export const metadata = { title: 'Privacy Policy' };

const SECTIONS = [
  {
    title: '1. Information We Collect',
    content: [
      {
        subtitle: '1.1 Account & Identity Information',
        text: 'When you register on Afri Connect, we collect your name, email address, job title, organisation name, and country of operation. For KYC/KYB verification purposes, we may also collect government-issued identification, company registration documents, and beneficial ownership information.',
      },
      {
        subtitle: '1.2 Project & Financial Data',
        text: 'Project developers submit technical specifications, financial models, feasibility studies, environmental impact assessments, grid connection agreements, and other project documentation. This data is used exclusively for AI-driven readiness scoring and partner matching.',
      },
      {
        subtitle: '1.3 Platform Usage Data',
        text: 'We collect information about how you interact with the platform, including pages visited, features used, search queries, and engagement actions. This data is used to improve platform performance and personalise your experience.',
      },
      {
        subtitle: '1.4 Communications',
        text: 'Messages exchanged through the platform\'s secure messaging system are stored to maintain deal workflow continuity and comply with applicable financial regulations.',
      },
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      {
        subtitle: '2.1 Platform Operations',
        text: 'Your data is used to operate the platform, process your registration, verify your identity, score your projects, and match you with appropriate counterparties.',
      },
      {
        subtitle: '2.2 AI Scoring & Analysis',
        text: 'Project documentation is processed by our AI scoring engine to generate readiness scores across regulatory, financial, and technical dimensions. This analysis is performed on our secure infrastructure and is not shared with third parties.',
      },
      {
        subtitle: '2.3 Partner Matching',
        text: 'Anonymised project summaries may be surfaced to verified investors and technical partners based on matching criteria. Full project data is only shared after an explicit "Express Interest" action and, where applicable, execution of a digital NDA.',
      },
      {
        subtitle: '2.4 Legal & Compliance',
        text: 'We may use your information to comply with applicable laws, respond to lawful requests from regulatory authorities, and enforce our Terms of Service.',
      },
    ],
  },
  {
    title: '3. Data Security',
    content: [
      {
        subtitle: '3.1 Encryption',
        text: 'All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. Document storage uses isolated, access-controlled buckets with server-side encryption.',
      },
      {
        subtitle: '3.2 Access Controls',
        text: 'Access to project data is governed by role-based permissions. Investors and partners can only access documents after explicit authorisation by the project developer. All access events are logged in an immutable audit trail.',
      },
      {
        subtitle: '3.3 Virtual Data Room (VDR)',
        text: 'Documents uploaded to the VDR are subject to NDA-based gatekeeping. Unauthorised access attempts are logged and flagged for review.',
      },
    ],
  },
  {
    title: '4. Data Sharing & Third Parties',
    content: [
      {
        subtitle: '4.1 No Data Sales',
        text: 'We do not sell, rent, or trade your personal or project data to any third party under any circumstances.',
      },
      {
        subtitle: '4.2 Service Providers',
        text: 'We engage trusted third-party service providers for infrastructure (cloud hosting, email delivery, analytics) under strict data processing agreements that prohibit them from using your data for any purpose other than providing services to us.',
      },
      {
        subtitle: '4.3 Legal Disclosures',
        text: 'We may disclose information if required by law, court order, or regulatory authority, or if we believe disclosure is necessary to protect the rights, property, or safety of Afri Connect, our users, or the public.',
      },
    ],
  },
  {
    title: '5. Data Retention',
    content: [
      {
        subtitle: '5.1 Active Accounts',
        text: 'We retain your data for as long as your account is active and as necessary to provide platform services.',
      },
      {
        subtitle: '5.2 Account Deletion',
        text: 'Upon account deletion, personal data is removed within 30 days. Project data may be retained in anonymised form for platform analytics and regulatory compliance purposes for up to 7 years.',
      },
    ],
  },
  {
    title: '6. Your Rights',
    content: [
      {
        subtitle: '6.1 Access & Portability',
        text: 'You have the right to request a copy of all personal data we hold about you in a portable, machine-readable format.',
      },
      {
        subtitle: '6.2 Correction & Deletion',
        text: 'You may request correction of inaccurate data or deletion of your personal data, subject to our legal retention obligations.',
      },
      {
        subtitle: '6.3 Objection & Restriction',
        text: 'You may object to or request restriction of certain processing activities. To exercise any of these rights, contact us at privacy@africonnect.io.',
      },
    ],
  },
  {
    title: '7. Cookies & Tracking',
    content: [
      {
        subtitle: '7.1 Essential Cookies',
        text: 'We use strictly necessary cookies to maintain your session, authenticate your identity, and ensure platform security. These cannot be disabled.',
      },
      {
        subtitle: '7.2 Analytics',
        text: 'With your consent, we use analytics cookies to understand platform usage patterns and improve the user experience. You may opt out at any time via your account settings.',
      },
    ],
  },
  {
    title: '8. Changes to This Policy',
    content: [
      {
        subtitle: '',
        text: 'We may update this Privacy Policy from time to time. Material changes will be communicated via email and a prominent notice on the platform at least 14 days before taking effect. Continued use of the platform after the effective date constitutes acceptance of the updated policy.',
      },
    ],
  },
  {
    title: '9. Contact',
    content: [
      {
        subtitle: '',
        text: 'For privacy-related enquiries, data subject requests, or to report a security concern, contact our Data Protection Officer at privacy@africonnect.io or write to: Afri Connect Ltd, Data Protection Officer, [Registered Address].',
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f3] font-sans selection:bg-green-100 selection:text-green-900">
      <PublicNavbar />

      {/* Hero */}
      <div className="bg-[#041f12] pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.22em] mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-white/40 text-base font-normal">Effective Date: April 19, 2026</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        {/* Intro */}
        <div className="bg-white border border-slate-200/80 p-8 mb-8 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
          <p className="text-slate-600 leading-relaxed text-sm">
            Afri Connect Ltd (&ldquo;Afri Connect&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) is committed to protecting the privacy and security of your personal and project data. This Privacy Policy explains how we collect, use, store, and protect information when you use the Afri Connect platform (&ldquo;Platform&rdquo;). By accessing or using the Platform, you agree to the practices described in this policy.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <div key={section.title} className="bg-white border border-slate-200/80 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
              <div className="px-8 py-5 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">{section.title}</h2>
              </div>
              <div className="px-8 py-6 space-y-5">
                {section.content.map((item, i) => (
                  <div key={i}>
                    {item.subtitle && (
                      <h3 className="text-sm font-bold text-slate-700 mb-1.5">{item.subtitle}</h3>
                    )}
                    <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
