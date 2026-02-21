'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { 
  Zap, 
  Building2, 
  Users, 
  TrendingUp, 
  Shield, 
  Globe,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function Home() {
  const { user, loading, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-blue-600 p-1.5 rounded-lg mr-2">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Energy Capital Match</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="#features" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Features</Link>
              <Link href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">How It Works</Link>
              <Link href="#pricing" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Pricing</Link>
            </nav>
            <div className="flex items-center space-x-4">
              {loading ? (
                <div className="h-9 w-24 bg-gray-100 animate-pulse rounded-lg" />
              ) : user ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => signOut()}
                    className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
                  >
                    Sign Out
                  </button>
                  <Link
                    href="/dashboard"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm hover:shadow-md"
                  >
                    Dashboard
                  </Link>
                </div>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors">Sign In</Link>
                  <Link
                    href="/register"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm hover:shadow-md"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-50 to-white py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 leading-tight">
              Connect Capital with 
              <span className="text-blue-600"> Energy Projects</span>
            </h1>
            <p className="mt-6 text-xl text-gray-600">
              The premier platform for structured capital and project intelligence in energy infrastructure. 
              Connect with verified developers, capital partners, and technical experts.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link 
                href="/register" 
                className="flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-lg"
              >
                Start Matching <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link 
                href="#how-it-works" 
                className="flex items-center border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition text-lg"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Platform Features</h2>
            <p className="mt-4 text-xl text-gray-600">
              Everything you need to connect, evaluate, and close energy infrastructure deals
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Building2 className="h-6 w-6 text-blue-600" />}
              title="Project Intelligence"
              description="Comprehensive project data with technical readiness scoring and AI-powered risk analysis"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6 text-blue-600" />}
              title="Smart Matching"
              description="AI-driven matching algorithm connects projects with compatible capital and technical partners"
            />
            <FeatureCard
              icon={<TrendingUp className="h-6 w-6 text-blue-600" />}
              title="Capital Readiness"
              description="Scoring engine evaluates project readiness across documentation, governance, and transparency"
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6 text-blue-600" />}
              title="Verified Partners"
              description="Multi-role platform ensures all participants are verified and credentialed"
            />
            <FeatureCard
              icon={<Globe className="h-6 w-6 text-blue-600" />}
              title="Global Reach"
              description="Connect with partners across multiple geographies and energy sectors"
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6 text-blue-600" />}
              title="Structured Capital"
              description="Support for equity, profit sharing, leasing, and grant structures only"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-xl text-gray-600">
              Streamlined workflow from project submission to deal closure
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <StepCard
              number="1"
              title="Create Profile"
              description="Sign up as a developer, capital partner, or technical partner"
            />
            <StepCard
              number="2"
              title="Submit Project"
              description="Add project details, documentation, and capital requirements"
            />
            <StepCard
              number="3"
              title="Get Matched"
              description="AI scores your project and matches you with compatible partners"
            />
            <StepCard
              number="4"
              title="Close Deal"
              description="Engage with partners and track progress through structured workflow"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to Transform Energy Infrastructure?</h2>
          <p className="mt-4 text-xl text-blue-100">
            Join the platform connecting capital with clean energy projects worldwide
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link 
              href="/register" 
              className="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-gray-100 transition text-lg font-medium"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center text-white">
                <Zap className="h-6 w-6" />
                <span className="ml-2 text-lg font-bold">Energy Capital Match</span>
              </div>
              <p className="mt-4 text-sm">
                Connecting capital with energy infrastructure projects globally.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Features</Link></li>
                <li><Link href="#" className="hover:text-white">Pricing</Link></li>
                <li><Link href="#" className="hover:text-white">API</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">About</Link></li>
                <li><Link href="#" className="hover:text-white">Blog</Link></li>
                <li><Link href="#" className="hover:text-white">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Privacy</Link></li>
                <li><Link href="#" className="hover:text-white">Terms</Link></li>
                <li><Link href="#" className="hover:text-white">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-sm text-center">
            © 2025 Energy Capital Match. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
      <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}
