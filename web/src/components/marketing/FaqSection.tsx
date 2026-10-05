'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '@/components/ui/icons';

const FAQS = [
  {
    question: 'What is Afri Connect?',
    answer: 'Afri Connect is an institutional marketplace connecting African energy project developers with financiers, EPC contractors, and technical consultants. We use AI-driven vetting and structured data rooms to standardize the project finance lifecycle.',
  },
  {
    question: 'How does the AI scoring work?',
    answer: 'Our AI engine analyzes uploaded project documents, technical specifications, and financial data across three dimensions: regulatory readiness, financial readiness, and technical readiness. It produces a composite score and identifies documentation gaps that need to be addressed before the project can attract institutional capital.',
  },
  {
    question: 'Who can use the platform?',
    answer: 'The platform serves four main user types: Project Developers (who create and manage projects), Financiers & Investors (who discover and evaluate opportunities), EPC Contractors & Consultants (who provide technical services), and Platform Administrators (who manage the ecosystem).',
  },
  {
    question: 'What types of projects are accepted?',
    answer: 'We accept renewable energy projects across solar PV, wind, hydro, battery storage, biomass, and other clean energy technologies. Projects at any stage — from concept through to construction — can be registered and scored.',
  },
  {
    question: 'How is project data protected?',
    answer: 'All project data is encrypted at rest and in transit. Document access is controlled through role-based permissions. Projects can be set to public (visible to verified investors) or restricted (visible only to invited partners). We implement KYC/KYB verification for all platform users.',
  },
  {
    question: 'How do I get started?',
    answer: 'Register for an account, complete your organization profile with KYC/KYB documentation, and submit your first project. The AI scoring engine will analyze your submission and provide a readiness score with specific recommendations for improvement.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-28 md:py-36 bg-[#f5f6f3] relative overflow-hidden">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[10px] font-bold text-green-700 uppercase tracking-[0.22em] mb-4"
          >
            FAQ
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight"
          >
            Frequently Asked Questions
          </motion.h2>
        </div>

        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-slate-200/80 overflow-hidden shadow-[0_2px_8px_rgba(15,23,42,0.04)]"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left"
              >
                <span className="text-sm font-bold text-slate-900 pr-4">{faq.question}</span>
                <div className={`w-8 h-8 flex items-center justify-center shrink-0 transition-colors duration-200 ${openIndex === i ? 'bg-green-800 text-white' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                  <Icons.chevronDown className={`size-4 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`} />
                </div>
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-0">
                      <p className="text-sm text-slate-500 leading-relaxed">{faq.answer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
