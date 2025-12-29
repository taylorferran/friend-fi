'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';

const demos = [
  {
    id: 'predictions',
    title: 'Prediction Market Speed Demo',
    description: 'Watch 7 users create wallets, join a group, place bets, and settle in real-time',
    icon: '⚡',
    href: '/demo-predictions',
    features: [
      '7 users with 0.05 USDC each',
      'Each bets 95% (0.0475 USDC)',
      'Real-time transaction feed',
      '0.3% platform fee collected',
      'Parallel voting execution',
    ],
    color: 'primary',
  },
  {
    id: 'expenses',
    title: 'Expense Splitting Speed Demo',
    description: 'Watch 3 friends split expenses from a holiday with automatic debt calculation',
    icon: '💰',
    href: '/demo-expenses',
    features: [
      '3 users on holiday',
      '4 shared expenses',
      'Automatic debt calculation',
      'On-chain settlements',
      '0.3% settlement fee',
    ],
    color: 'green-600',
  },
  {
    id: 'habits',
    title: 'Habit Tracker Speed Demo',
    description: 'Watch 2 users create a gym commitment, compete, and see who wins the stakes',
    icon: '💪',
    href: '/demo-habits',
    features: [
      '2 users with 0.05 USDC each',
      'Gym 3x/week challenge',
      'Check-in tracking',
      'Winner takes pool',
      '0.3% platform fee',
    ],
    color: 'purple-600',
  },
];

export default function DemoSelectorPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b-4 border-text bg-surface">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Logo />
              <div>
                <h1 className="text-3xl font-display font-bold text-text">Friend-Fi Demos</h1>
                <p className="text-accent font-mono text-sm">Choose a demo to watch the platform in action</p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center px-4 py-2 border-2 border-text bg-surface hover:bg-primary transition-colors font-mono font-bold"
            >
              <span className="material-symbols-outlined text-sm mr-2">arrow_back</span>
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {demos.map((demo) => (
            <Link key={demo.id} href={demo.href}>
              <Card className="h-full hover:border-primary hover:shadow-[8px_8px_0_theme(colors.primary)] transition-all cursor-pointer flex flex-col">
                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-4 flex-1 flex flex-col">
                    {/* Icon & Title */}
                    <div>
                      <div className="text-6xl mb-3">{demo.icon}</div>
                      <h2 className="text-xl font-display font-bold text-text mb-2">
                        {demo.title}
                      </h2>
                      <p className="text-sm font-mono text-accent">
                        {demo.description}
                      </p>
                    </div>

                    {/* Features */}
                    <div className="border-t-2 border-text pt-4 flex-1">
                      <h3 className="text-xs font-mono font-bold text-accent uppercase mb-2">
                        Features:
                      </h3>
                      <ul className="space-y-1">
                        {demo.features.map((feature, idx) => (
                          <li key={idx} className="text-xs font-mono text-text flex items-start gap-2">
                            <span className="text-primary mt-0.5">▸</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* CTA */}
                    <div className={`mt-4 p-3 border-2 border-text bg-${demo.color}/10 text-center`}>
                      <span className="font-mono font-bold text-text text-sm">
                        Run Demo →
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Info Banner */}
        <Card className="mt-12 border-4 border-primary">
          <CardContent>
            <div className="flex items-start gap-4">
              <span className="material-symbols-outlined text-primary text-3xl">info</span>
              <div>
                <h3 className="font-display font-bold text-text mb-2">About These Demos</h3>
                <div className="space-y-2 font-mono text-sm text-accent">
                  <p>
                    All demos use real on-chain transactions on Movement Testnet. Every action you see is actually happening on the blockchain.
                  </p>
                  <p>
                    <strong className="text-text">Speed Demos</strong> run automatically and complete in ~60 seconds with full transaction history.
                  </p>
                  <p className="text-primary font-bold">
                    ⚡ Gas fees are sponsored by Shinami - users don't need MOVE tokens!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

