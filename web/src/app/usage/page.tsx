import { PublicNavbar } from '@/components/marketing/PublicNavbar';
import { PublicFooter } from '@/components/marketing/PublicFooter';

export const metadata = { title: 'Acceptable Use Policy' };

const SECTIONS = [
  {
    title: '1. Purpose',
    content: [
      {
        subtitle: '',
        text: 'This Acceptable Use Policy ("AUP") sets out the rules governing how users may access and use the Afri Connect platform ("Platform"). It supplements our Terms of Service and Privacy Policy. By using the Platform, you agree to comply with this AUP. Violations may result in immediate suspension or termination of your account.',
      },
    ],
  },
  {
    title: '2. Permitted Uses',
    content: [
      {
        subtitle: '2.1 Project Development',
        text: 'Project developers may use the Platform to register energy infrastructure projects, upload supporting documentation, receive AI-driven readiness scores, identify documentation gaps, and engage with verified investors and technical partners.',
      },
      {
        subtitle: '2.2 Investment & Due Diligence',
        text: 'Verified investors and financiers may use the Platform to discover and evaluate energy projects, access structured data rooms under NDA, communicate with project developers, and manage their deal pipeline.',
      },
      {
        subtitle: '2.3 Technical Services',
        text: 'EPC contractors, consultants, and other technical service providers may use the Platform to discover active projects seeking their expertise, respond to engagement requests, and manage service delivery workflows.',
      },
      {
        subtitle: '2.4 Platform Administration',
        text: 'Platform administrators may use administrative tools to manage user accounts, review project submissions, enforce compliance, and maintain platform integrity.',
      },
    ],
  },
  {
    title: '3. Prohibited Uses',
    content: [
      {
        subtitle: '3.1 Fraudulent Activity',
        text: 'You may not submit false, misleading, or fabricated project data, financial models, or identity documents. You may not impersonate another person, organisation, or entity. Fraudulent activity will be reported to relevant regulatory and law enforcement authorities.',
      },
      {
        subtitle: '3.2 Market Manipulation',
        text: 'You may not use the Platform to engage in any form of market manipulation, including artificial inflation of project valuations, coordinated misrepresentation of project readiness, or dissemination of false information to influence investment decisions.',
      },
      {
        subtitle: '3.3 Unauthorised Data Access',
        text: 'You may not attempt to access project data, user accounts, or platform systems beyond your authorised permissions. You may not attempt to bypass NDA gatekeeping, circumvent access controls, or exploit platform vulnerabilities.',
      },
      {
        subtitle: '3.4 Scraping & Automated Access',
        text: 'You may not use bots, scrapers, crawlers, or other automated tools to extract data from the Platform without prior written authorisation from Afri Connect.',
      },
      {
        subtitle: '3.5 Harmful Content',
        text: 'You may not upload or transmit malware, viruses, or any code designed to disrupt, damage, or gain unauthorised access to any system. You may not upload content that is defamatory, discriminatory, or otherwise unlawful.',
      },
      {
        subtitle: '3.6 Circumvention',
        text: 'You may not use contact information or introductions obtained through the Platform to conduct transactions outside the Platform in violation of the non-circumvention obligations set out in the Terms of Service.',
      },
      {
        subtitle: '3.7 Resale & Sublicensing',
        text: 'You may not resell, sublicense, or otherwise commercialise access to the Platform or its data without express written authorisation from Afri Connect.',
      },
    ],
  },
  {
    title: '4. Data Room Usage',
    content: [
      {
        subtitle: '4.1 NDA Compliance',
        text: 'Access to Virtual Data Room (VDR) contents is conditional on execution of the applicable NDA. You may not share, reproduce, or distribute VDR contents outside the Platform without the express written consent of the project developer.',
      },
      {
        subtitle: '4.2 Confidentiality',
        text: 'All project information accessed through the Platform, whether or not formally designated as confidential, must be treated as confidential and used solely for the purpose of evaluating the specific project for which access was granted.',
      },
      {
        subtitle: '4.3 Document Integrity',
        text: 'You may not alter, annotate, or modify documents accessed through the VDR. Any analysis or commentary must be maintained separately and not attributed to the original document.',
      },
    ],
  },
  {
    title: '5. AI Scoring & Outputs',
    content: [
      {
        subtitle: '5.1 Informational Purpose Only',
        text: 'AI-generated readiness scores, gap analyses, and partner recommendations are provided for informational purposes only. They do not constitute investment advice, legal advice, or a guarantee of project viability or partner suitability.',
      },
      {
        subtitle: '5.2 Independent Verification',
        text: 'All users are expected to conduct independent due diligence before making investment, financing, or engagement decisions. Reliance solely on AI scoring outputs without independent verification is at the user\'s own risk.',
      },
      {
        subtitle: '5.3 Score Manipulation',
        text: 'You may not attempt to manipulate AI scoring outputs by submitting false or misleading documentation, gaming document upload sequences, or exploiting known scoring heuristics.',
      },
    ],
  },
  {
    title: '6. Communication Standards',
    content: [
      {
        subtitle: '6.1 Professional Conduct',
        text: 'All communications through the Platform\'s messaging system must be professional, respectful, and relevant to the business purpose of the Platform. Harassment, threats, or abusive language will result in immediate account suspension.',
      },
      {
        subtitle: '6.2 Spam & Unsolicited Contact',
        text: 'You may not send unsolicited bulk messages, promotional content, or spam through the Platform\'s messaging system. Engagement requests must be genuine and relevant to the recipient\'s stated interests.',
      },
    ],
  },
  {
    title: '7. Reporting Violations',
    content: [
      {
        subtitle: '',
        text: 'If you become aware of any violation of this AUP, please report it immediately to compliance@africonnect.io. We take all reports seriously and will investigate promptly. Whistleblowers acting in good faith will be protected from retaliation.',
      },
    ],
  },
  {
    title: '8. Consequences of Violation',
    content: [
      {
        subtitle: '8.1 Enforcement Actions',
        text: 'Violations of this AUP may result in a formal warning, temporary suspension of account access, permanent termination of your account, removal of project listings, legal action, and/or reporting to relevant regulatory authorities.',
      },
      {
        subtitle: '8.2 No Refunds',
        text: 'Account termination due to AUP violations does not entitle you to a refund of any fees paid.',
      },
    ],
  },
  {
    title: '9. Updates to This Policy',
    content: [
      {
        subtitle: '',
        text: 'We may update this AUP from time to time to reflect changes in platform features, applicable law, or industry best practices. Material changes will be communicated via email and a platform notice at least 14 days before taking effect.',
      },
    ],
  },
  {
    title: '10. Contact',
    content: [
      {
        subtitle: '',
        text: 'For questions about this Acceptable Use Policy, contact us at compliance@africonnect.io or write to: Afri Connect Ltd, Compliance Department, [Registered Address].',
      },
    ],
  },
];

export default function UsagePage() {
  return (
    <div className="min-h-screen bg-[#f5f6f3] font-sans selection:bg-green-100 selection:text-green-900">
      <PublicNavbar />

      {/* Hero */}
      <div className="bg-[#041f12] pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.22em] mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">Acceptable Use Policy</h1>
          <p className="text-white/40 text-base font-normal">Last Updated: April 19, 2026</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        {/* Intro */}
        <div className="bg-white border border-slate-200/80 p-8 mb-8 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
          <p className="text-slate-600 leading-relaxed text-sm">
            This Acceptable Use Policy defines the standards of conduct expected of all users of the Afri Connect platform. It is designed to protect the integrity of the platform, the confidentiality of project data, and the interests of all participants in the African energy infrastructure ecosystem.
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
