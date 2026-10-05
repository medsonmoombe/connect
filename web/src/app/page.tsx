import { PublicFooter } from '@/components/marketing/PublicFooter';
import { PublicNavbar } from '@/components/marketing/PublicNavbar';
import { HeroSection } from '@/components/marketing/HeroSection';
import { SocialProofBar } from '@/components/marketing/SocialProofBar';
import { HowItWorks } from '@/components/marketing/HowItWorks';
import { FeaturesGrid } from '@/components/marketing/FeaturesGrid';
import { MarketplacePreview } from '@/components/marketing/MarketplacePreview';
import { IntelligenceSection } from '@/components/marketing/IntelligenceSection';
import { TestimonialsSection } from '@/components/marketing/TestimonialsSection';
import { FaqSection } from '@/components/marketing/FaqSection';
import { CtaSection } from '@/components/marketing/CtaSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f5f6f3] font-sans selection:bg-green-100 selection:text-green-900 overflow-x-hidden">
      <PublicNavbar />
      <HeroSection />
      <SocialProofBar />
      <HowItWorks />
      <FeaturesGrid />
      <MarketplacePreview />
      <IntelligenceSection />
      <TestimonialsSection />
      <FaqSection />
      <CtaSection />
      <PublicFooter />
    </div>
  );
}
