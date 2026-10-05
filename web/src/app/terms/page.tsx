import { PublicNavbar } from '@/components/marketing/PublicNavbar';
import { PublicFooter } from '@/components/marketing/PublicFooter';

export const metadata = { title: 'Terms of Service' };

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: [
      {
        subtitle: '',
        text: 'By accessing or using the Afri Connect platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform. These Terms constitute a legally binding agreement between you and Afri Connect Ltd ("Afri Connect", "we", "us", or "our").',
      },
    ],
  },
  {
    title: '2. Eligibility',
    content: [
      {
        subtitle: '2.1 Institutional Users',
        text: 'The Platform is intended for institutional investors, professional energy project developers, EPC contractors, technical consultants, grant providers, and other verified infrastructure finance professionals. Use by retail investors or individuals without relevant professional standing is not permitted.',
      },
      {
        subtitle: '2.2 Age & Capacity',
        text: 'You must be at least 18 years of age and have the legal capacity to enter into binding contracts on behalf of yourself or your organisation.',
      },
      {
        subtitle: '2.3 KYC/KYB Verification',
        text: 'All users are required to complete identity and organisational verification (KYC/KYB) before accessing full platform features. We reserve the right to suspend or terminate accounts that fail verification or provide false information.',
      },
    ],
  },
  {
    title: '3. Platform Services',
    content: [
      {
        subtitle: '3.1 Project Submission & Scoring',
        text: 'Project developers may submit energy infrastructure projects for AI-driven readiness scoring. Scores are generated algorithmically and represent an assessment of documentation completeness and project maturity. Scores do not constitute investment advice or a guarantee of project viability.',
      },
      {
        subtitle: '3.2 Partner Matching',
        text: 'The Platform uses automated matching algorithms to connect project developers with investors, EPC contractors, consultants, and other partners. Match recommendations are provided for informational purposes only. Afri Connect does not guarantee the suitability, performance, or conduct of any matched counterparty.',
      },
      {
        subtitle: '3.3 Virtual Data Room',
        text: 'The Platform provides a Virtual Data Room (VDR) for secure document sharing. Access to VDR contents is controlled by the project developer and governed by NDA agreements executed through the Platform. Afri Connect is not a party to any NDA between users.',
      },
      {
        subtitle: '3.4 Messaging & Engagement',
        text: 'The Platform provides secure messaging and engagement workflow tools. All communications through the Platform are subject to these Terms and our Privacy Policy.',
      },
    ],
  },
  {
    title: '4. Non-Circumvention',
    content: [
      {
        subtitle: '4.1 Platform Integrity',
        text: 'Users agree not to circumvent the Platform to close transactions with counterparties identified through the Platform without proper disclosure to Afri Connect. This obligation survives for 24 months following the initial introduction of the counterparty through the Platform.',
      },
      {
        subtitle: '4.2 Reporting',
        text: 'Users who become aware of circumvention attempts by other users are encouraged to report such activity to compliance@africonnect.io.',
      },
    ],
  },
  {
    title: '5. User Obligations',
    content: [
      {
        subtitle: '5.1 Accuracy of Information',
        text: 'You are solely responsible for the accuracy, completeness, and legality of all information and documents you submit to the Platform. Submission of false, misleading, or fraudulent information is grounds for immediate account termination and may result in legal action.',
      },
      {
        subtitle: '5.2 Prohibited Conduct',
        text: 'You may not use the Platform to engage in market manipulation, money laundering, fraud, or any other illegal activity. You may not attempt to reverse-engineer, scrape, or otherwise extract data from the Platform without written authorisation.',
      },
      {
        subtitle: '5.3 Account Security',
        text: 'You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately at security@africonnect.io if you suspect unauthorised access to your account.',
      },
    ],
  },
  {
    title: '6. Intellectual Property',
    content: [
      {
        subtitle: '6.1 Platform IP',
        text: 'All software, algorithms, scoring methodologies, design elements, and content comprising the Platform are the exclusive intellectual property of Afri Connect Ltd. No licence to use Platform IP is granted except as expressly set out in these Terms.',
      },
      {
        subtitle: '6.2 User Content',
        text: 'You retain ownership of all project data and documents you submit to the Platform. By submitting content, you grant Afri Connect a limited, non-exclusive licence to process, analyse, and display your content solely for the purpose of providing Platform services.',
      },
    ],
  },
  {
    title: '7. Disclaimers & Limitation of Liability',
    content: [
      {
        subtitle: '7.1 No Investment Advice',
        text: 'Nothing on the Platform constitutes investment advice, financial advice, legal advice, or any other professional advice. AI scoring outputs are informational tools only. All investment decisions must be made based on independent due diligence.',
      },
      {
        subtitle: '7.2 Platform Availability',
        text: 'We strive to maintain high platform availability but do not guarantee uninterrupted access. We are not liable for losses arising from platform downtime, data loss, or technical failures.',
      },
      {
        subtitle: '7.3 Limitation of Liability',
        text: 'To the maximum extent permitted by applicable law, Afri Connect\'s total liability to you for any claim arising from use of the Platform shall not exceed the fees paid by you to Afri Connect in the 12 months preceding the claim.',
      },
    ],
  },
  {
    title: '8. Termination',
    content: [
      {
        subtitle: '8.1 By You',
        text: 'You may terminate your account at any time by contacting support@africonnect.io. Termination does not affect any obligations incurred prior to termination, including non-circumvention obligations.',
      },
      {
        subtitle: '8.2 By Afri Connect',
        text: 'We reserve the right to suspend or terminate your account immediately, without notice, if you breach these Terms, fail KYC/KYB verification, or engage in conduct that we determine, in our sole discretion, to be harmful to the Platform or its users.',
      },
    ],
  },
  {
    title: '9. Governing Law',
    content: [
      {
        subtitle: '',
        text: 'These Terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales, unless otherwise required by applicable mandatory law.',
      },
    ],
  },
  {
    title: '10. Changes to These Terms',
    content: [
      {
        subtitle: '',
        text: 'We may update these Terms from time to time. Material changes will be communicated via email and a prominent notice on the Platform at least 14 days before taking effect. Continued use of the Platform after the effective date constitutes acceptance of the updated Terms.',
      },
    ],
  },
  {
    title: '11. Contact',
    content: [
      {
        subtitle: '',
        text: 'For questions about these Terms, contact our legal team at legal@africonnect.io or write to: Afri Connect Ltd, Legal Department, [Registered Address].',
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="h-full overflow-y-auto bg-[#f5f6f3] font-sans selection:bg-green-100 selection:text-green-900">
      <PublicNavbar />

      {/* Hero */}
      <div className="bg-[#041f12] pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.22em] mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">Terms of Service</h1>
          <p className="text-white/40 text-base font-normal">Last Updated: April 19, 2026</p>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        {/* Intro */}
        <div className="bg-white border border-slate-200/80 p-8 mb-8 shadow-[0_4px_24px_rgba(15,23,42,0.05)]">
          <p className="text-slate-600 leading-relaxed text-sm">
            Please read these Terms of Service carefully before using the Afri Connect platform. These Terms govern your access to and use of all services provided by Afri Connect Ltd, including the project marketplace, AI scoring engine, virtual data room, partner matching, and secure messaging features.
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
