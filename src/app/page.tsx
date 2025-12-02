'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

// Preload routes in the background
const ROUTES_TO_PRELOAD = ['/login', '/dashboard', '/groups/create', '/groups/join', '/bets', '/leaderboard'];

export default function SplashPage() {
  const { login, authenticated } = usePrivy();
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Preload routes
  useEffect(() => {
    ROUTES_TO_PRELOAD.forEach((route) => {
      router.prefetch(route);
    });
  }, [router]);

  // Staggered animation trigger
  useEffect(() => {
    const timer1 = setTimeout(() => setIsLoaded(true), 100);
    const timer2 = setTimeout(() => setShowContent(true), 600);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Word animation
  useEffect(() => {
    if (!showContent) return;
    const words = ['Bet', 'with', 'friends,', 'privately.'];
    if (wordIndex < words.length) {
      const timer = setTimeout(() => {
        setWordIndex(prev => prev + 1);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showContent, wordIndex]);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate scroll progress for each section - more aggressive animations
  const heroOpacity = Math.max(0, 1 - scrollY / 250);
  const heroTranslate = scrollY * 0.6;
  const heroScale = Math.max(0.85, 1 - scrollY / 800);
  
  // Earlier triggers for sections
  const appsProgress = Math.min(1, Math.max(0, (scrollY - 20) / 200));
  const featuresProgress = Math.min(1, Math.max(0, (scrollY - 250) / 200));
  const howItWorksProgress = Math.min(1, Math.max(0, (scrollY - 500) / 200));
  const ctaProgress = Math.min(1, Math.max(0, (scrollY - 750) / 200));

  const words = ['Bet', 'with', 'friends,', 'privately.'];

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#08050d]">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-[#08050d]">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f071a] via-[#08050d] to-[#050208]" />
        
        {/* Animated mesh gradient */}
        <div 
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 20% 40%, rgba(115, 17, 212, 0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 20%, rgba(115, 17, 212, 0.1) 0%, transparent 50%),
              radial-gradient(ellipse 50% 60% at 60% 80%, rgba(90, 13, 168, 0.12) 0%, transparent 50%)
            `,
            animation: 'meshMove 20s ease-in-out infinite',
          }}
        />
        
        {/* Main moving orb */}
        <div 
          className="absolute w-[800px] h-[800px] rounded-full"
          style={{ 
            background: 'radial-gradient(circle, rgba(115, 17, 212, 0.25) 0%, rgba(115, 17, 212, 0.08) 40%, transparent 70%)',
            top: '-15%',
            left: '-10%',
            animation: 'orbFloat 15s ease-in-out infinite',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Secondary orb */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{ 
            background: 'radial-gradient(circle, rgba(115, 17, 212, 0.2) 0%, rgba(90, 13, 168, 0.06) 40%, transparent 70%)',
            bottom: '-10%',
            right: '-5%',
            animation: 'orbFloat2 12s ease-in-out infinite',
            filter: 'blur(50px)',
          }}
        />
        
        {/* Third orb */}
        <div 
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ 
            background: 'radial-gradient(circle, rgba(115, 17, 212, 0.18) 0%, transparent 60%)',
            top: '30%',
            left: '50%',
            animation: 'orbFloat3 18s ease-in-out infinite',
            filter: 'blur(60px)',
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-[#7311d4]/30"
              style={{
                left: `${10 + i * 12}%`,
                top: `${15 + (i % 4) * 20}%`,
                animation: `particleFloat ${6 + i}s ease-in-out infinite ${i * 0.5}s`,
              }}
            />
          ))}
        </div>
        
        {/* Subtle grid */}
        <div className="absolute inset-0 grid-pattern opacity-[0.08]" />
      </div>

      {/* Initial loading overlay */}
      <div 
        className={`fixed inset-0 z-50 bg-[#08050d] flex items-center justify-center transition-all duration-1000 ${
          isLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
        <div className="relative">
          <div className="w-16 h-16 relative">
            <div className="absolute inset-0 bg-[#7311d4] rounded-full blur-xl opacity-40 animate-pulse" />
            <div className="relative w-full h-full flex items-center justify-center">
              <svg className="w-12 h-12 text-[#7311d4]" fill="currentColor" viewBox="0 0 32 32">
                <circle cx="10" cy="8" r="5" />
                <path d="M2 26C2 20.4772 6.47715 16 12 16H12C14.2091 16 16 17.7909 16 20V26C16 27.1046 15.1046 28 14 28H4C2.89543 28 2 27.1046 2 26Z" opacity="0.7" />
                <circle cx="22" cy="8" r="5" />
                <path d="M16 26C16 20.4772 20.4772 16 26 16H26C28.2091 16 30 17.7909 30 20V26C30 27.1046 29.1046 28 28 28H18C16.8954 28 16 27.1046 16 26Z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`relative z-10 transition-opacity duration-1000 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
        {/* Fixed Navigation */}
        <header 
          className={`fixed top-0 left-0 right-0 z-40 px-4 sm:px-6 lg:px-20 py-4 transition-all duration-300`}
          style={{ 
            backgroundColor: scrollY > 50 ? 'rgba(8, 5, 13, 0.95)' : 'transparent',
            backdropFilter: scrollY > 50 ? 'blur(20px)' : 'none',
            boxShadow: scrollY > 50 ? '0 4px 30px rgba(0, 0, 0, 0.3)' : 'none',
          }}
        >
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Logo size="md" />
            
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#apps" className="text-white/60 hover:text-white transition-colors text-sm font-medium">Apps</a>
              <a href="#features" className="text-white/60 hover:text-white transition-colors text-sm font-medium">Features</a>
              <a href="#how-it-works" className="text-white/60 hover:text-white transition-colors text-sm font-medium">How it Works</a>
              {authenticated ? (
                <Link href="/dashboard">
                  <Button size="sm">Dashboard</Button>
                </Link>
              ) : (
                <Button size="sm" onClick={() => login()}>Launch App</Button>
              )}
            </nav>

            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white/70 hover:text-white"
            >
              <span className="material-symbols-outlined">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden absolute top-full left-0 right-0 bg-[#08050d]/98 backdrop-blur-xl p-4">
              <nav className="flex flex-col gap-4">
                <a href="#apps" onClick={() => setMobileMenuOpen(false)} className="text-white/80 hover:text-white transition-colors text-base font-medium py-2">Apps</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-white/80 hover:text-white transition-colors text-base font-medium py-2">Features</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-white/80 hover:text-white transition-colors text-base font-medium py-2">How it Works</a>
                <div className="pt-2 border-t border-white/10">
                  {authenticated ? (
                    <Link href="/dashboard" className="block">
                      <Button className="w-full">Dashboard</Button>
                    </Link>
                  ) : (
                    <Button className="w-full" onClick={() => login()}>Launch App</Button>
                  )}
                </div>
              </nav>
            </div>
          )}
        </header>

        {/* Hero Section - Reduced height */}
        <section 
          className="relative min-h-[70vh] flex items-center justify-center px-4 sm:px-6 lg:px-20 pt-20"
          style={{
            opacity: heroOpacity,
            transform: `translateY(-${heroTranslate}px) scale(${heroScale})`,
          }}
        >
          <div className="w-full text-center">
            {/* Badge */}
            <div className="animate-slide-up inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6 sm:mb-8">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="text-white/70 text-xs sm:text-sm">Live on Movement Testnet</span>
            </div>

            {/* Animated Headline - Centered single line */}
            <h1 className="text-[2rem] sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black text-white leading-[1.05] tracking-tight mb-6 sm:mb-8 mx-auto">
              <span className="inline-flex justify-center flex-wrap sm:flex-nowrap gap-x-2 sm:gap-x-3 lg:gap-x-4">
                {words.map((word, i) => (
                  <span
                    key={word}
                    className={`transition-all duration-500 ${
                      i < wordIndex 
                        ? 'opacity-100 translate-y-0' 
                        : 'opacity-0 translate-y-8'
                    } ${word === 'friends,' ? 'shimmer-text' : ''} ${word === 'privately.' ? 'text-white/50' : ''}`}
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    {word}
                  </span>
                ))}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="animate-slide-up delay-500 text-base sm:text-lg lg:text-xl text-white/60 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-4">
              A suite of social DeFi apps for your inner circle. 
              Wager, compete, and hold each other accountable—all on-chain and encrypted.
            </p>

            {/* CTA Buttons */}
            <div className="animate-slide-up delay-600 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              {authenticated ? (
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto">
                    Go to Dashboard
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Button>
                </Link>
              ) : (
                <Button size="lg" onClick={() => login()} className="w-full sm:w-auto">
                  Get Started
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Button>
              )}
              <a href="#apps" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Explore Apps
                </Button>
              </a>
            </div>

            {/* Trust indicators */}
            <div className="animate-slide-up delay-700 flex flex-wrap gap-4 sm:gap-6 mt-8 sm:mt-10 pt-6 sm:pt-8 border-t border-white/10 justify-center mx-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7311d4] text-lg sm:text-xl">lock</span>
                <span className="text-white/50 text-xs sm:text-sm">Encrypted</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#10B981] text-lg sm:text-xl">local_gas_station</span>
                <span className="text-white/50 text-xs sm:text-sm">Gas Free</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7311d4] text-lg sm:text-xl">payments</span>
                <span className="text-white/50 text-xs sm:text-sm">USDC Only</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7311d4] text-lg sm:text-xl">mail</span>
                <span className="text-white/50 text-xs sm:text-sm">Email Login</span>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="animate-slide-up delay-800 mt-6 sm:mt-8 flex justify-center">
              <div className="flex flex-col items-center gap-2 text-white/30">
                <span className="text-xs uppercase tracking-wider">Scroll to explore</span>
                <span className="material-symbols-outlined animate-bounce">keyboard_arrow_down</span>
              </div>
            </div>
          </div>
        </section>

        {/* Apps Section - Closer to hero, more scroll animation */}
        <section 
          id="apps" 
          className="relative px-4 sm:px-6 lg:px-20 py-12 sm:py-16"
          style={{
            opacity: appsProgress,
            transform: `translateY(${(1 - appsProgress) * 120}px) scale(${0.95 + appsProgress * 0.05})`,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <div 
              className="text-center mb-10 sm:mb-14"
              style={{
                opacity: appsProgress,
                transform: `translateY(${(1 - appsProgress) * 50}px)`,
              }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                Social DeFi Apps
              </h2>
              <p className="text-white/60 text-base sm:text-lg max-w-2xl mx-auto px-4">
                Multiple ways to engage with your friends on-chain. All encrypted, gasless, and using USDC.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
              {/* Private Predictions - Active */}
              <div 
                className="group relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#7311d4]/20 to-[#7311d4]/5 border border-[#7311d4]/30 hover:border-[#7311d4]/50 transition-all duration-300"
                style={{
                  opacity: appsProgress,
                  transform: `translateX(${(1 - appsProgress) * -80}px) rotate(${(1 - appsProgress) * -2}deg)`,
                }}
              >
                {/* Active badge */}
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-xs font-bold">
                  LIVE
                </div>
                
                <div className="w-14 h-14 rounded-xl mb-6 flex items-center justify-center bg-[#7311d4]/30">
                  <span className="material-symbols-outlined text-3xl text-[#7311d4]">casino</span>
                </div>
                
                <h3 className="text-white text-xl sm:text-2xl font-bold mb-3">Private Predictions</h3>
                <p className="text-white/60 text-sm sm:text-base leading-relaxed mb-6">
                  Create predictions, wager USDC, and settle bets within your trusted circle. 
                  &ldquo;Will Alice and Bob follow through with the wedding?&rdquo;
                </p>
                
                <ul className="space-y-2 mb-6">
                  {['Group-only betting', 'Admin-settled outcomes', 'Twitch-style payouts'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-white/70 text-sm">
                      <span className="material-symbols-outlined text-[#10B981] text-lg">check_circle</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                {authenticated ? (
                  <Link href="/dashboard">
                    <Button className="w-full">
                      Open App
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </Button>
                  </Link>
                ) : (
                  <Button onClick={() => login()} className="w-full">
                    Get Started
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </Button>
                )}
              </div>

              {/* Accountability Tracker - Coming Soon */}
              <div 
                className="group relative p-6 sm:p-8 rounded-2xl bg-[#191022]/50 border border-white/10 hover:border-white/20 transition-all duration-300"
                style={{
                  opacity: appsProgress,
                  transform: `translateX(${(1 - appsProgress) * 80}px) rotate(${(1 - appsProgress) * 2}deg)`,
                }}
              >
                {/* Coming soon badge */}
                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs font-bold">
                  COMING SOON
                </div>
                
                <div className="w-14 h-14 rounded-xl mb-6 flex items-center justify-center bg-white/10">
                  <span className="material-symbols-outlined text-3xl text-white/60">fitness_center</span>
                </div>
                
                <h3 className="text-white text-xl sm:text-2xl font-bold mb-3">Accountability Tracker</h3>
                <p className="text-white/60 text-sm sm:text-base leading-relaxed mb-6">
                  Put your money where your mouth is. Wager on habits with friends—hit the gym 3x/week or lose your stake.
                </p>
                
                <ul className="space-y-2 mb-6">
                  {['Daily/weekly check-ins', 'Photo proof verification', 'Stake your commitment'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-white/50 text-sm">
                      <span className="material-symbols-outlined text-white/30 text-lg">radio_button_unchecked</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <Button variant="secondary" className="w-full opacity-50 cursor-not-allowed" disabled>
                  Coming Q1 2025
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - Enhanced animations */}
        <section 
          id="features" 
          className="relative px-4 sm:px-6 lg:px-20 py-12 sm:py-16 overflow-hidden"
          style={{
            opacity: featuresProgress,
            transform: `translateY(${(1 - featuresProgress) * 100}px)`,
          }}
        >
          {/* Animated background glow for this section */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 60% 40% at 50% 50%, rgba(115, 17, 212, ${0.08 * featuresProgress}) 0%, transparent 70%)`,
            }}
          />
          
          <div className="max-w-7xl mx-auto relative">
            <div 
              className="text-center mb-10 sm:mb-12"
              style={{
                opacity: featuresProgress,
                transform: `translateY(${(1 - featuresProgress) * 40}px) scale(${0.9 + featuresProgress * 0.1})`,
              }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                Why Friend-Fi?
              </h2>
              <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto px-4">
                Built for normies. Powered by blockchain.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[
                {
                  icon: 'lock',
                  title: 'End-to-End Encrypted',
                  desc: 'Your data is encrypted with your group password before going on-chain. Not even we can see it.',
                },
                {
                  icon: 'local_gas_station',
                  title: 'Zero Gas Fees',
                  desc: 'We sponsor all transaction costs via Shinami. You just need USDC for your wagers.',
                },
                {
                  icon: 'groups',
                  title: 'Friend-Only Access',
                  desc: 'Private groups with invite codes. Only interact with people you actually know and trust.',
                },
              ].map((feature, i) => (
                <div 
                  key={feature.title}
                  className="group relative p-6 sm:p-8 rounded-2xl glass hover:bg-white/5 transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
                  style={{
                    opacity: featuresProgress,
                    transform: `translateY(${(1 - featuresProgress) * (80 + i * 30)}px) rotate(${(1 - featuresProgress) * (i === 1 ? 0 : i === 0 ? -3 : 3)}deg)`,
                  }}
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 rounded-2xl bg-[#7311d4]/0 group-hover:bg-[#7311d4]/5 transition-all duration-500" />
                  
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl mb-4 sm:mb-6 flex items-center justify-center bg-[#7311d4]/20 group-hover:bg-[#7311d4]/30 transition-all duration-300 group-hover:scale-110">
                      <span className="material-symbols-outlined text-xl sm:text-2xl text-[#7311d4] group-hover:scale-110 transition-transform duration-300">
                        {feature.icon}
                      </span>
                    </div>
                    <h3 className="text-white text-lg sm:text-xl font-bold mb-2 sm:mb-3 group-hover:text-[#7311d4] transition-colors duration-300">{feature.title}</h3>
                    <p className="text-white/60 text-sm sm:text-base leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - Enhanced animations */}
        <section 
          id="how-it-works" 
          className="relative px-4 sm:px-6 lg:px-20 py-12 sm:py-20 overflow-hidden"
          style={{
            opacity: howItWorksProgress,
            transform: `translateY(${(1 - howItWorksProgress) * 80}px)`,
          }}
        >
          <div className="max-w-7xl mx-auto">
            <div 
              className="text-center mb-10 sm:mb-14"
              style={{
                opacity: howItWorksProgress,
                transform: `scale(${0.85 + howItWorksProgress * 0.15})`,
              }}
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                How It Works
              </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
              {[
                { step: '01', icon: 'mail', title: 'Sign In', desc: 'Email login via Privy. Your Move wallet is created automatically.' },
                { step: '02', icon: 'group_add', title: 'Create Group', desc: 'Set up a private group with an ID and encryption password.' },
                { step: '03', icon: 'apps', title: 'Pick an App', desc: 'Choose from predictions, accountability tracking, and more.' },
                { step: '04', icon: 'emoji_events', title: 'Play & Win', desc: 'Wager with friends. Winners get paid automatically.' },
              ].map((item, i) => (
                <div 
                  key={item.step}
                  className="group relative text-center"
                  style={{
                    opacity: howItWorksProgress,
                    transform: `translateY(${(1 - howItWorksProgress) * (60 + i * 20)}px) scale(${0.8 + howItWorksProgress * 0.2})`,
                  }}
                >
                  {/* Animated connector line */}
                  {i < 3 && (
                    <div 
                      className="hidden lg:block absolute top-10 left-1/2 h-px overflow-hidden"
                      style={{ width: `${howItWorksProgress * 100}%` }}
                    >
                      <div 
                        className="w-full h-full bg-gradient-to-r from-[#7311d4]/60 to-[#7311d4]/10"
                        style={{
                          animation: howItWorksProgress === 1 ? 'shimmer 2s ease-in-out infinite' : 'none',
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="relative z-10">
                    {/* Animated icon container */}
                    <div 
                      className="w-14 h-14 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#7311d4]/20 to-[#7311d4]/5 flex items-center justify-center border border-white/10 group-hover:border-[#7311d4]/40 group-hover:from-[#7311d4]/30 group-hover:to-[#7311d4]/10 transition-all duration-500 group-hover:scale-110"
                      style={{
                        animation: howItWorksProgress === 1 ? `pulse-glow 3s ease-in-out infinite ${i * 0.5}s` : 'none',
                      }}
                    >
                      <span 
                        className="material-symbols-outlined text-[#7311d4] text-xl sm:text-3xl group-hover:scale-110 transition-transform duration-300"
                      >
                        {item.icon}
                      </span>
                    </div>
                    
                    {/* Step number with pulse */}
                    <div 
                      className="text-[#7311d4] text-xs font-bold tracking-wider mb-1 sm:mb-2"
                      style={{
                        opacity: 0.6 + howItWorksProgress * 0.4,
                      }}
                    >
                      {item.step}
                    </div>
                    <h3 className="text-white font-bold text-sm sm:text-lg mb-1 sm:mb-2 group-hover:text-[#7311d4] transition-colors duration-300">{item.title}</h3>
                    <p className="text-white/50 text-xs sm:text-sm leading-relaxed group-hover:text-white/70 transition-colors duration-300">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section - Enhanced animations */}
        <section 
          className="relative px-4 sm:px-6 lg:px-20 py-12 sm:py-20"
          style={{
            opacity: ctaProgress,
            transform: `translateY(${(1 - ctaProgress) * 60}px) scale(${0.9 + ctaProgress * 0.1})`,
          }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="relative glass rounded-2xl sm:rounded-3xl p-8 sm:p-12 lg:p-16 text-center overflow-hidden group">
              {/* Animated gradient background */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(115, 17, 212, 0.15) 0%, transparent 60%)',
                }}
              />
              
              {/* Moving glow orbs */}
              <div 
                className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-[#7311d4]/20 blur-3xl"
                style={{
                  animation: ctaProgress === 1 ? 'ctaOrb1 8s ease-in-out infinite' : 'none',
                }}
              />
              <div 
                className="absolute -bottom-20 -right-20 w-40 h-40 rounded-full bg-[#7311d4]/15 blur-3xl"
                style={{
                  animation: ctaProgress === 1 ? 'ctaOrb2 10s ease-in-out infinite' : 'none',
                }}
              />
              
              {/* Border glow effect */}
              <div 
                className="absolute inset-0 rounded-2xl sm:rounded-3xl border border-[#7311d4]/0 group-hover:border-[#7311d4]/30 transition-all duration-500"
                style={{
                  boxShadow: ctaProgress === 1 ? '0 0 60px rgba(115, 17, 212, 0.1)' : 'none',
                }}
              />
              
              <div className="relative z-10">
                {/* Animated heading */}
                <h2 
                  className="text-2xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6"
                  style={{
                    opacity: ctaProgress,
                    transform: `translateY(${(1 - ctaProgress) * 30}px)`,
                  }}
                >
                  Ready to start?
                </h2>
                
                {/* Animated paragraph */}
                <p 
                  className="text-white/60 text-sm sm:text-lg mb-6 sm:mb-10 max-w-lg mx-auto"
                  style={{
                    opacity: ctaProgress,
                    transform: `translateY(${(1 - ctaProgress) * 20}px)`,
                  }}
                >
                  Create your first private group and invite your friends. It&apos;s free to get started.
                </p>
                
                {/* Animated button container */}
                <div
                  style={{
                    opacity: ctaProgress,
                    transform: `translateY(${(1 - ctaProgress) * 10}px) scale(${0.95 + ctaProgress * 0.05})`,
                  }}
                >
                  {authenticated ? (
                    <Link href="/dashboard">
                      <Button size="lg" className="w-full sm:w-auto group/btn">
                        Go to Dashboard
                        <span className="material-symbols-outlined group-hover/btn:translate-x-1 transition-transform duration-300">arrow_forward</span>
                      </Button>
                    </Link>
                  ) : (
                    <Button size="lg" onClick={() => login()} className="w-full sm:w-auto group/btn">
                      Get Started Free
                      <span className="material-symbols-outlined group-hover/btn:translate-x-1 transition-transform duration-300">arrow_forward</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative px-4 sm:px-6 lg:px-20 py-8 sm:py-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Logo size="sm" />
              <span className="text-white/30 text-xs sm:text-sm">Built on Movement Network</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
