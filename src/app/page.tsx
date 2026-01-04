'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export default function LandingPage() {
  const [showContent, setShowContent] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [showHeader, setShowHeader] = useState(false);
  const [titleComplete, setTitleComplete] = useState(false);

  // Handle "Launch App" click - opens app subdomain in new window
  const handleLaunchApp = useCallback(() => {
    window.open('https://app.friend-fi.com', '_blank', 'noopener,noreferrer');
  }, []);

  // Refs for scroll animations
  const appsRef = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);
  const howItWorksRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  // Show header after scrolling past hero
  useEffect(() => {
    const handleScroll = () => {
      if (heroRef.current) {
        const heroBottom = heroRef.current.offsetTop + heroRef.current.offsetHeight;
        setShowHeader(window.scrollY > heroBottom - 100);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Start content animation immediately
  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Word animation - slower for 3 words
  useEffect(() => {
    if (!showContent) return;
    const words = ['DeFi', 'with', 'friends.'];
    if (wordIndex < words.length) {
      const timer = setTimeout(() => {
        setWordIndex(prev => prev + 1);
      }, 500); // Slower animation for fewer words
      return () => clearTimeout(timer);
    } else {
      // Title animation complete, show rest after a longer delay
      const timer = setTimeout(() => {
        setTitleComplete(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [showContent, wordIndex]);

  // Scroll-based animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    // Observe all scroll-reveal elements
    const elements = document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .scroll-reveal-scale');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [showContent]);

  const words = ['DeFi', 'with', 'friends.'];

  return (
    <div className="relative min-h-screen bg-background mobile-content">
      {/* Grid pattern background */}
      <div className="fixed inset-0 -z-10 grid-pattern" />

      {/* Main Content */}
      <div className={`relative z-10 transition-opacity duration-300 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
        {/* Fixed Navigation - Hidden until scroll */}
        <header className={`fixed top-0 left-0 right-0 z-40 bg-background border-b-2 border-text transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
          <div className="flex items-center justify-between mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center py-4">
              <Logo size="lg" />
            </div>
            
            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              <a href="#apps" className="px-4 py-2 hover:bg-primary/20 transition-colors font-mono uppercase text-sm tracking-wider font-bold text-text">Apps</a>
              <a href="#features" className="px-4 py-2 hover:bg-primary/20 transition-colors font-mono uppercase text-sm tracking-wider font-bold text-text">Features</a>
              <a href="#how-it-works" className="px-4 py-2 hover:bg-primary/20 transition-colors font-mono uppercase text-sm tracking-wider font-bold text-text">How it Works</a>
              <div className="ml-4">
                <Button size="sm" onClick={handleLaunchApp}>
                  Launch App
                </Button>
              </div>
            </nav>

            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-text"
            >
              <span className="material-symbols-outlined text-3xl">
                {mobileMenuOpen ? 'close' : 'menu'}
              </span>
            </button>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-surface border-t-2 border-text">
              <nav className="flex flex-col">
                <a href="#apps" onClick={() => setMobileMenuOpen(false)} className="px-6 py-4 border-b-2 border-text hover:bg-primary/20 transition-colors font-mono uppercase text-sm tracking-wider font-bold text-text">Apps</a>
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="px-6 py-4 border-b-2 border-text hover:bg-primary/20 transition-colors font-mono uppercase text-sm tracking-wider font-bold text-text">Features</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="px-6 py-4 border-b-2 border-text hover:bg-primary/20 transition-colors font-mono uppercase text-sm tracking-wider font-bold text-text">How it Works</a>
                <div className="p-4">
                  <Button className="w-full" onClick={handleLaunchApp}>
                    Launch App
                  </Button>
                </div>
              </nav>
            </div>
          )}
        </header>

        {/* Hero Section - Text Focused */}
        <section ref={heroRef} className="relative min-h-screen flex flex-col justify-center px-4 sm:px-6 lg:px-8 overflow-hidden py-20">
          {/* Animated Background Shapes - Reduced on mobile for readability */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Hide most shapes on mobile, show only a few */}
            <div className="hidden sm:block">
            {/* TOP EDGE - Row 1 (very top) - 16 shapes */}
            <div className="absolute top-1 left-[1%] w-12 h-12 border-4 border-primary bg-primary/10 animate-drift-1" />
            <div className="absolute top-3 left-[5%] w-6 h-6 bg-secondary animate-drift-2" style={{ animationDelay: '-0.5s' }} />
            <div className="absolute top-0 left-[9%] w-8 h-8 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-1s' }} />
            <div className="absolute top-4 left-[13%] w-10 h-10 bg-primary/30 animate-drift-1" style={{ animationDelay: '-1.5s' }} />
            <div className="absolute top-2 left-[17%] w-5 h-5 border-4 border-primary animate-drift-2" style={{ animationDelay: '-2s' }} />
            <div className="absolute top-1 left-[21%] w-8 h-8 bg-secondary/40 animate-drift-3" style={{ animationDelay: '-2.5s' }} />
            <div className="absolute top-5 left-[25%] w-6 h-6 border-4 border-secondary animate-drift-1" style={{ animationDelay: '-3s' }} />
            <div className="absolute top-3 left-[29%] w-10 h-10 bg-primary/20 animate-drift-2" style={{ animationDelay: '-3.5s' }} />
            <div className="absolute top-2 right-[29%] w-8 h-8 border-4 border-primary animate-drift-3" style={{ animationDelay: '-4s' }} />
            <div className="absolute top-4 right-[25%] w-5 h-5 bg-secondary animate-drift-1" style={{ animationDelay: '-4.5s' }} />
            <div className="absolute top-0 right-[21%] w-6 h-6 border-4 border-secondary animate-drift-2" style={{ animationDelay: '-5s' }} />
            <div className="absolute top-3 right-[17%] w-10 h-10 bg-primary/30 animate-drift-3" style={{ animationDelay: '-5.5s' }} />
            <div className="absolute top-1 right-[13%] w-8 h-8 border-4 border-primary animate-drift-1" style={{ animationDelay: '-6s' }} />
            <div className="absolute top-5 right-[9%] w-6 h-6 bg-secondary/30 animate-drift-2" style={{ animationDelay: '-6.5s' }} />
            <div className="absolute top-2 right-[5%] w-5 h-5 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-7s' }} />
            <div className="absolute top-0 right-[1%] w-12 h-12 bg-primary/10 border-4 border-primary animate-drift-1" style={{ animationDelay: '-7.5s' }} />
            
            {/* TOP EDGE - Row 2 - 12 shapes */}
            <div className="absolute top-14 left-[3%] w-8 h-8 bg-primary/20 animate-drift-2" style={{ animationDelay: '-1s' }} />
            <div className="absolute top-18 left-[8%] w-5 h-5 border-4 border-secondary animate-drift-1" style={{ animationDelay: '-2s' }} />
            <div className="absolute top-12 left-[13%] w-6 h-6 bg-secondary/40 animate-drift-3" style={{ animationDelay: '-3s' }} />
            <div className="absolute top-16 left-[18%] w-10 h-10 border-4 border-primary animate-drift-2" style={{ animationDelay: '-4s' }} />
            <div className="absolute top-20 left-[23%] w-4 h-4 bg-primary animate-drift-1" style={{ animationDelay: '-5s' }} />
            <div className="absolute top-14 left-[28%] w-8 h-8 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-6s' }} />
            <div className="absolute top-14 right-[28%] w-6 h-6 bg-primary/30 animate-drift-1" style={{ animationDelay: '-1.5s' }} />
            <div className="absolute top-20 right-[23%] w-4 h-4 border-4 border-primary animate-drift-2" style={{ animationDelay: '-2.5s' }} />
            <div className="absolute top-16 right-[18%] w-10 h-10 bg-secondary/20 animate-drift-3" style={{ animationDelay: '-3.5s' }} />
            <div className="absolute top-12 right-[13%] w-6 h-6 border-4 border-secondary animate-drift-1" style={{ animationDelay: '-4.5s' }} />
            <div className="absolute top-18 right-[8%] w-5 h-5 bg-primary animate-drift-2" style={{ animationDelay: '-5.5s' }} />
            <div className="absolute top-14 right-[3%] w-8 h-8 border-4 border-primary animate-drift-3" style={{ animationDelay: '-6.5s' }} />
            
            {/* LEFT EDGE - 16 shapes */}
            <div className="absolute top-[12%] left-1 w-8 h-8 border-4 border-primary animate-drift-3" style={{ animationDelay: '-0.5s' }} />
            <div className="absolute top-[16%] left-5 w-5 h-5 bg-secondary/40 animate-drift-1" style={{ animationDelay: '-1s' }} />
            <div className="absolute top-[20%] left-2 w-6 h-6 border-4 border-secondary animate-drift-2" style={{ animationDelay: '-1.5s' }} />
            <div className="absolute top-[24%] left-6 w-10 h-10 bg-primary/20 animate-drift-3" style={{ animationDelay: '-2s' }} />
            <div className="absolute top-[28%] left-1 w-4 h-4 border-4 border-primary animate-drift-1" style={{ animationDelay: '-2.5s' }} />
            <div className="absolute top-[32%] left-4 w-8 h-8 bg-secondary animate-drift-2" style={{ animationDelay: '-3s' }} />
            <div className="absolute top-[36%] left-2 w-6 h-6 border-4 border-accent animate-drift-3" style={{ animationDelay: '-3.5s' }} />
            <div className="absolute top-[40%] left-5 w-5 h-5 bg-primary/40 animate-drift-1" style={{ animationDelay: '-4s' }} />
            <div className="absolute top-[44%] left-1 w-10 h-10 border-4 border-secondary animate-drift-2" style={{ animationDelay: '-4.5s' }} />
            <div className="absolute top-[48%] left-4 w-6 h-6 bg-primary animate-drift-3" style={{ animationDelay: '-5s' }} />
            <div className="absolute top-[52%] left-2 w-8 h-8 border-4 border-primary animate-drift-1" style={{ animationDelay: '-5.5s' }} />
            <div className="absolute top-[56%] left-6 w-4 h-4 bg-secondary/30 animate-drift-2" style={{ animationDelay: '-6s' }} />
            <div className="absolute top-[60%] left-1 w-6 h-6 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-6.5s' }} />
            <div className="absolute top-[64%] left-5 w-10 h-10 bg-primary/20 animate-drift-1" style={{ animationDelay: '-7s' }} />
            <div className="absolute top-[68%] left-2 w-5 h-5 border-4 border-primary animate-drift-2" style={{ animationDelay: '-7.5s' }} />
            <div className="absolute top-[72%] left-4 w-8 h-8 bg-secondary animate-drift-3" style={{ animationDelay: '-8s' }} />
            
            {/* RIGHT EDGE - 16 shapes */}
            <div className="absolute top-[12%] right-1 w-6 h-6 border-4 border-secondary animate-drift-2" style={{ animationDelay: '-0.5s' }} />
            <div className="absolute top-[16%] right-5 w-8 h-8 bg-primary/30 animate-drift-3" style={{ animationDelay: '-1s' }} />
            <div className="absolute top-[20%] right-2 w-5 h-5 border-4 border-primary animate-drift-1" style={{ animationDelay: '-1.5s' }} />
            <div className="absolute top-[24%] right-6 w-10 h-10 bg-secondary/20 animate-drift-2" style={{ animationDelay: '-2s' }} />
            <div className="absolute top-[28%] right-1 w-6 h-6 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-2.5s' }} />
            <div className="absolute top-[32%] right-4 w-8 h-8 bg-primary animate-drift-1" style={{ animationDelay: '-3s' }} />
            <div className="absolute top-[36%] right-2 w-4 h-4 border-4 border-accent animate-drift-2" style={{ animationDelay: '-3.5s' }} />
            <div className="absolute top-[40%] right-5 w-6 h-6 bg-secondary/40 animate-drift-3" style={{ animationDelay: '-4s' }} />
            <div className="absolute top-[44%] right-1 w-10 h-10 border-4 border-primary animate-drift-1" style={{ animationDelay: '-4.5s' }} />
            <div className="absolute top-[48%] right-4 w-5 h-5 bg-primary/20 animate-drift-2" style={{ animationDelay: '-5s' }} />
            <div className="absolute top-[52%] right-2 w-8 h-8 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-5.5s' }} />
            <div className="absolute top-[56%] right-6 w-6 h-6 bg-secondary animate-drift-1" style={{ animationDelay: '-6s' }} />
            <div className="absolute top-[60%] right-1 w-4 h-4 border-4 border-primary animate-drift-2" style={{ animationDelay: '-6.5s' }} />
            <div className="absolute top-[64%] right-5 w-10 h-10 bg-primary/30 animate-drift-3" style={{ animationDelay: '-7s' }} />
            <div className="absolute top-[68%] right-2 w-6 h-6 border-4 border-secondary animate-drift-1" style={{ animationDelay: '-7.5s' }} />
            <div className="absolute top-[72%] right-4 w-8 h-8 bg-secondary/20 animate-drift-2" style={{ animationDelay: '-8s' }} />
            
            {/* BOTTOM EDGE - Row 1 - 12 shapes */}
            <div className="absolute bottom-28 left-[3%] w-8 h-8 bg-primary/20 animate-drift-1" style={{ animationDelay: '-1s' }} />
            <div className="absolute bottom-32 left-[8%] w-5 h-5 border-4 border-secondary animate-drift-2" style={{ animationDelay: '-2s' }} />
            <div className="absolute bottom-26 left-[13%] w-6 h-6 bg-secondary/40 animate-drift-3" style={{ animationDelay: '-3s' }} />
            <div className="absolute bottom-30 left-[18%] w-10 h-10 border-4 border-primary animate-drift-1" style={{ animationDelay: '-4s' }} />
            <div className="absolute bottom-34 left-[23%] w-4 h-4 bg-primary animate-drift-2" style={{ animationDelay: '-5s' }} />
            <div className="absolute bottom-28 left-[28%] w-8 h-8 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-6s' }} />
            <div className="absolute bottom-28 right-[28%] w-6 h-6 bg-primary/30 animate-drift-2" style={{ animationDelay: '-1.5s' }} />
            <div className="absolute bottom-34 right-[23%] w-4 h-4 border-4 border-primary animate-drift-3" style={{ animationDelay: '-2.5s' }} />
            <div className="absolute bottom-30 right-[18%] w-10 h-10 bg-secondary/20 animate-drift-1" style={{ animationDelay: '-3.5s' }} />
            <div className="absolute bottom-26 right-[13%] w-6 h-6 border-4 border-secondary animate-drift-2" style={{ animationDelay: '-4.5s' }} />
            <div className="absolute bottom-32 right-[8%] w-5 h-5 bg-primary animate-drift-3" style={{ animationDelay: '-5.5s' }} />
            <div className="absolute bottom-28 right-[3%] w-8 h-8 border-4 border-primary animate-drift-1" style={{ animationDelay: '-6.5s' }} />
            
            {/* BOTTOM EDGE - Row 2 - 16 shapes */}
            <div className="absolute bottom-40 left-[1%] w-10 h-10 border-4 border-primary bg-primary/10 animate-drift-2" style={{ animationDelay: '-0.5s' }} />
            <div className="absolute bottom-44 left-[5%] w-6 h-6 bg-secondary animate-drift-3" style={{ animationDelay: '-1s' }} />
            <div className="absolute bottom-38 left-[9%] w-8 h-8 border-4 border-secondary animate-drift-1" style={{ animationDelay: '-1.5s' }} />
            <div className="absolute bottom-42 left-[13%] w-5 h-5 bg-primary/40 animate-drift-2" style={{ animationDelay: '-2s' }} />
            <div className="absolute bottom-46 left-[17%] w-6 h-6 border-4 border-primary animate-drift-3" style={{ animationDelay: '-2.5s' }} />
            <div className="absolute bottom-40 left-[21%] w-10 h-10 bg-secondary/30 animate-drift-1" style={{ animationDelay: '-3s' }} />
            <div className="absolute bottom-44 left-[25%] w-4 h-4 border-4 border-secondary animate-drift-2" style={{ animationDelay: '-3.5s' }} />
            <div className="absolute bottom-38 left-[29%] w-8 h-8 bg-primary/20 animate-drift-3" style={{ animationDelay: '-4s' }} />
            <div className="absolute bottom-38 right-[29%] w-6 h-6 border-4 border-primary animate-drift-1" style={{ animationDelay: '-4.5s' }} />
            <div className="absolute bottom-44 right-[25%] w-4 h-4 bg-secondary animate-drift-2" style={{ animationDelay: '-5s' }} />
            <div className="absolute bottom-40 right-[21%] w-10 h-10 border-4 border-secondary animate-drift-3" style={{ animationDelay: '-5.5s' }} />
            <div className="absolute bottom-46 right-[17%] w-6 h-6 bg-primary/30 animate-drift-1" style={{ animationDelay: '-6s' }} />
            <div className="absolute bottom-42 right-[13%] w-5 h-5 border-4 border-primary animate-drift-2" style={{ animationDelay: '-6.5s' }} />
            <div className="absolute bottom-38 right-[9%] w-8 h-8 bg-secondary/20 animate-drift-3" style={{ animationDelay: '-7s' }} />
            <div className="absolute bottom-44 right-[5%] w-6 h-6 border-4 border-secondary animate-drift-1" style={{ animationDelay: '-7.5s' }} />
            <div className="absolute bottom-40 right-[1%] w-10 h-10 bg-primary/10 border-4 border-primary animate-drift-2" style={{ animationDelay: '-8s' }} />
            
            {/* CORNER SPINNING ACCENTS - 8 total */}
            <div className="absolute top-6 left-6 w-14 h-14 border-4 border-primary/40 animate-spin-slow" style={{ animationDuration: '30s' }} />
            <div className="absolute top-20 left-16 w-8 h-8 border-4 border-secondary/30 animate-spin-slow" style={{ animationDuration: '20s', animationDirection: 'reverse' }} />
            <div className="absolute top-6 right-6 w-12 h-12 border-4 border-secondary/40 animate-spin-slow" style={{ animationDuration: '25s', animationDirection: 'reverse' }} />
            <div className="absolute top-20 right-16 w-8 h-8 border-4 border-primary/30 animate-spin-slow" style={{ animationDuration: '22s' }} />
            <div className="absolute bottom-36 left-6 w-10 h-10 border-4 border-accent/30 animate-spin-slow" style={{ animationDuration: '35s' }} />
            <div className="absolute bottom-48 left-16 w-6 h-6 border-4 border-primary/30 animate-spin-slow" style={{ animationDuration: '18s', animationDirection: 'reverse' }} />
            <div className="absolute bottom-36 right-6 w-8 h-8 border-4 border-primary/30 animate-spin-slow" style={{ animationDuration: '28s', animationDirection: 'reverse' }} />
            <div className="absolute bottom-48 right-16 w-6 h-6 border-4 border-secondary/30 animate-spin-slow" style={{ animationDuration: '24s' }} />
            </div>
            </div>
            
            {/* Mobile: Only show minimal shapes */}
            <div className="sm:hidden">
              <div className="absolute top-4 left-4 w-6 h-6 border-2 border-primary/30 animate-drift-1" />
              <div className="absolute top-8 right-4 w-4 h-4 bg-secondary/20 animate-drift-2" style={{ animationDelay: '-1s' }} />
              <div className="absolute bottom-20 left-6 w-5 h-5 border-2 border-primary/30 animate-drift-3" style={{ animationDelay: '-2s' }} />
              <div className="absolute bottom-16 right-6 w-4 h-4 bg-secondary/20 animate-drift-1" style={{ animationDelay: '-3s' }} />
            </div>

          <div className="max-w-7xl mx-auto relative z-10 w-full flex-grow flex flex-col justify-center pt-24">
            <div className="text-center">
              {/* Giant Headline with Stagger - Loads first */}
              <h1 className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-bold text-text leading-[0.9] mb-12">
                {words.map((word, i) => (
                  <span
                    key={word}
                    className={`inline-block mx-2 sm:mx-4 transition-all duration-1000 ${
                      i < wordIndex 
                        ? 'opacity-100 translate-y-0 rotate-0' 
                        : 'opacity-0 translate-y-20 rotate-6'
                    } ${word === 'friends.' ? 'text-secondary' : ''}`}
                    style={{ transitionDelay: `${i * 200}ms` }}
                  >
                    {word}
                  </span>
                ))}
            </h1>

              {/* Subheadline - Appears after title animation completes */}
              <p className={`text-xl md:text-2xl lg:text-3xl text-accent max-w-4xl mx-auto mb-12 font-mono leading-relaxed transition-all duration-700 ${
                titleComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}>
                Social DeFi for your inner circle. 
              </p>

              {/* CTA Button + Badge - Appears after title animation completes */}
              <div className={`flex flex-col items-center gap-4 transition-all duration-700 delay-200 ${
                titleComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}>
                <div className="flex items-center gap-4">
                  <Button variant="secondary" size="lg" className="text-lg px-12 py-5" onClick={handleLaunchApp}>
                    Launch App
                    <span className="material-symbols-outlined text-2xl">arrow_forward</span>
                  </Button>
                </div>
                
                <div className="inline-flex items-center gap-2 px-3 py-1.5 border-2 border-text bg-primary/80">
                  <span className="w-2 h-2 bg-green-500 animate-pulse" />
                  <span className="text-text text-[10px] font-mono uppercase tracking-widest font-bold">Live on Movement Testnet</span>
              </div>
              </div>
            </div>
              </div>

          {/* Scroll indicator - at bottom - Appears after title animation completes */}
          <div className={`mt-auto pt-8 pb-6 transition-all duration-700 delay-500 ${
            titleComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}>
            <div className="flex flex-col items-center gap-2 text-accent">
              <span className="text-[10px] font-mono uppercase tracking-widest">Scroll to explore</span>
              <span className="material-symbols-outlined text-xl animate-bounce">keyboard_arrow_down</span>
            </div>
          </div>
        </section>

        {/* Apps Section */}
        <section id="apps" ref={appsRef} className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-primary">
          <div className="max-w-7xl mx-auto">
            <div className="scroll-reveal mb-12">
              <h2 className="font-display text-4xl md:text-5xl text-text mb-4">
                Social DeFi Apps
              </h2>
              <p className="text-text/80 text-lg font-mono max-w-2xl">
                Multiple ways to engage with your friends on-chain. All encrypted, gasless, and using USDC.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Private Predictions - Active */}
              <div className="scroll-reveal-left p-8 bg-surface border-2 border-text hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[4px_4px_0_theme(colors.text)] transition-all flex flex-col h-full">
                <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-green-600 text-green-600 text-xs font-mono uppercase tracking-wider font-bold mb-6 w-fit">
                  <span className="w-2 h-2 bg-green-600 animate-pulse" />
                  LIVE
                </div>
                
                <div className="w-14 h-14 mb-6 flex items-center justify-center bg-primary border-2 border-text">
                  <span className="material-symbols-outlined text-3xl text-text">casino</span>
                </div>
                
                <h3 className="text-text text-2xl font-display font-bold mb-3">Private Predictions</h3>
                <p className="text-accent text-base font-mono leading-relaxed mb-6">
                  Create predictions, wager USDC, and settle bets within your trusted circle. 
                  &ldquo;Will Alice and Bob follow through with the wedding?&rdquo;
                </p>
                
                <ul className="space-y-3 mb-6">
                  {['Group-only betting', 'Admin-settled outcomes', 'Winner-takes-pool payouts'].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-text font-mono text-sm">
                      <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="mt-auto flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleLaunchApp}
                  >
                    Launch App
                    <span className="material-symbols-outlined">
                      arrow_forward
                    </span>
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1"
                    onClick={() => window.open('/demo-predictions', '_blank', 'noopener,noreferrer')}
                  >
                    Demo
                    <span className="material-symbols-outlined">
                      play_arrow
                    </span>
                  </Button>
                </div>
              </div>

              {/* Split Expenses - Active */}
              <div className="scroll-reveal p-8 bg-surface border-2 border-text hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[4px_4px_0_theme(colors.text)] transition-all flex flex-col h-full">
                <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-green-600 text-green-600 text-xs font-mono uppercase tracking-wider font-bold mb-6 w-fit">
                  <span className="w-2 h-2 bg-green-600 animate-pulse" />
                  LIVE
                </div>
                
                <div className="w-14 h-14 mb-6 flex items-center justify-center bg-primary border-2 border-text">
                  <span className="material-symbols-outlined text-3xl text-text">receipt_long</span>
                </div>
                
                <h3 className="text-text text-2xl font-display font-bold mb-3">Split Expenses</h3>
                <p className="text-accent text-base font-mono leading-relaxed mb-6">
                  On-chain shared expense ledger with rolling balances. Settle up with USDC—full transparency and accountability.
                </p>
                
                <ul className="space-y-3 mb-6">
                  {['Shared expense ledger', 'Rolling balances', 'One-click USDC settle'].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-text font-mono text-sm">
                      <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="mt-auto flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleLaunchApp}
                  >
                    Launch App
                    <span className="material-symbols-outlined">
                      arrow_forward
                    </span>
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1"
                    onClick={() => window.open('/demo-expenses', '_blank', 'noopener,noreferrer')}
                  >
                    Demo
                    <span className="material-symbols-outlined">
                      play_arrow
                    </span>
                  </Button>
                </div>
              </div>

              {/* Accountability Tracker - Active */}
              <div className="scroll-reveal-right p-8 bg-surface border-2 border-text hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[4px_4px_0_theme(colors.text)] transition-all flex flex-col h-full">
                <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-green-600 text-green-600 text-xs font-mono uppercase tracking-wider font-bold mb-6 w-fit">
                  <span className="w-2 h-2 bg-green-600 animate-pulse" />
                  LIVE
                </div>
                
                <div className="w-14 h-14 mb-6 flex items-center justify-center bg-primary border-2 border-text">
                  <span className="material-symbols-outlined text-3xl text-text">fitness_center</span>
                </div>
                
                <h3 className="text-text text-2xl font-display font-bold mb-3">Accountability Tracker</h3>
                <p className="text-accent text-base font-mono leading-relaxed mb-6">
                  Put your money where your mouth is. Wager on habits with friends—hit the gym 3x/week or lose your stake.
                </p>
                
                <ul className="space-y-3 mb-6">
                  {['Weekly check-in commitments', 'Stake USDC on goals', 'Winner-takes-pool payouts'].map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-text font-mono text-sm">
                      <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="mt-auto flex gap-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleLaunchApp}
                  >
                    Launch App
                    <span className="material-symbols-outlined">
                      arrow_forward
                    </span>
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="flex-1"
                    onClick={() => window.open('/demo-habits', '_blank', 'noopener,noreferrer')}
                  >
                    Demo
                    <span className="material-symbols-outlined">
                      play_arrow
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" ref={featuresRef} className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="scroll-reveal text-center mb-12">
              <h2 className="font-display text-4xl md:text-5xl text-text mb-4">
                Why Friend-Fi?
              </h2>
              <p className="text-accent text-lg font-mono">
                Built for normies. Powered by blockchain.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: 'groups',
                  title: 'Friend-Only Groups',
                  desc: 'Private groups with passwords. Only interact with people you actually know and trust.',
                  delay: 0,
                },
                {
                  icon: 'local_gas_station',
                  title: 'Zero Gas Fees',
                  desc: 'We sponsor all transaction costs via Shinami. No crypto knowledge needed.',
                  delay: 100,
                },
                {
                  icon: 'payments',
                  title: 'USDC Only',
                  desc: 'All wagers are in stablecoins. No volatility, no surprises—just dollar values.',
                  delay: 200,
                },
                {
                  icon: 'verified',
                  title: 'On-Chain Settlement',
                  desc: 'All bets and payments are recorded on Movement blockchain. Transparent and trustless.',
                  delay: 300,
                },
              ].map((feature, i) => (
                <div 
                  key={feature.title}
                  className="scroll-reveal-scale p-8 bg-surface border-2 border-text hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[4px_4px_0_theme(colors.text)] transition-all"
                  style={{ transitionDelay: `${feature.delay}ms` }}
                >
                  <div className="w-12 h-12 mb-6 flex items-center justify-center bg-primary border-2 border-text">
                    <span className="material-symbols-outlined text-2xl text-text">
                        {feature.icon}
                      </span>
                  </div>
                  <h3 className="text-text text-xl font-display font-bold mb-3">{feature.title}</h3>
                  <p className="text-accent font-mono text-sm leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" ref={howItWorksRef} className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-surface">
          <div className="max-w-7xl mx-auto">
            <div className="scroll-reveal text-center mb-12">
              <h2 className="font-display text-4xl md:text-5xl text-text">
                How It Works
              </h2>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { step: '01', icon: 'mail', title: 'Sign In', desc: 'Biometric authentication via WebAuthn. Your Move wallet is created automatically.' },
                { step: '02', icon: 'group_add', title: 'Create Group', desc: 'Set up a private group with an ID and encryption password.' },
                { step: '03', icon: 'apps', title: 'Pick an App', desc: 'Choose from predictions, accountability tracking, and more.' },
                { step: '04', icon: 'emoji_events', title: 'Play & Win', desc: 'Wager with friends. Winners get paid automatically.' },
              ].map((item, i) => (
                <div 
                  key={item.step}
                  className="scroll-reveal text-center p-6 bg-background border-2 border-text hover:bg-primary/10 transition-colors"
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="w-16 h-16 mx-auto mb-6 bg-primary border-2 border-text flex items-center justify-center">
                    <span className="material-symbols-outlined text-text text-3xl">
                        {item.icon}
                      </span>
                    </div>
                    
                  <div className="text-primary text-xs font-mono font-bold tracking-wider mb-2">
                      {item.step}
                  </div>
                  <h3 className="text-text font-display font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-accent font-mono text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section ref={ctaRef} className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 bg-black border-y-4 border-text">
          <div className="max-w-3xl mx-auto text-center">
            <div className="scroll-reveal-scale">
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
                  Ready to start?
                </h2>
                
              <p className="text-white/80 text-lg font-mono mb-10">
                  Create your first private group and invite your friends. It&apos;s free to get started.
                </p>
                
              <Button 
                size="lg" 
                className="bg-primary text-text border-primary hover:bg-primary/90" 
                onClick={handleLaunchApp}
              >
                Launch App
                <span className="material-symbols-outlined">
                  arrow_forward
                </span>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 sm:px-6 lg:px-8 bg-background border-t-2 border-text">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Logo size="sm" />
                <span className="text-accent text-xs font-mono uppercase tracking-wider">Built on Movement Network</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
