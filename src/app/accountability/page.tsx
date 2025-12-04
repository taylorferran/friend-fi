'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';

// Mock accountability data
const mockChallenges = [
  { 
    id: '1', 
    title: 'Gym 4x per week', 
    stake: 100, 
    participants: 4, 
    duration: '4 weeks',
    progress: 75,
    checkIns: 12,
    requiredCheckIns: 16,
    status: 'active'
  },
  { 
    id: '2', 
    title: 'No alcohol for 30 days', 
    stake: 50, 
    participants: 3, 
    duration: '30 days',
    progress: 40,
    checkIns: 12,
    requiredCheckIns: 30,
    status: 'active'
  },
  { 
    id: '3', 
    title: 'Read 1 book per week', 
    stake: 25, 
    participants: 5, 
    duration: '8 weeks',
    progress: 100,
    checkIns: 8,
    requiredCheckIns: 8,
    status: 'completed'
  },
];

const mockLeaderboard = [
  { user: 'Sarah', avatar: 'luna', streak: 28, completionRate: 95 },
  { user: 'Michael', avatar: 'felix', streak: 21, completionRate: 88 },
  { user: 'You', avatar: 'leo', streak: 14, completionRate: 82, isYou: true },
  { user: 'David', avatar: 'max', streak: 7, completionRate: 65 },
];

export default function AccountabilityPage() {
  const router = useRouter();
  const { authenticated, ready } = usePrivy();

  useEffect(() => {
    if (ready && !authenticated) {
      router.push('/login');
    }
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutalist-spinner">
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
          <div className="brutalist-spinner-box"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 mobile-content p-4 lg:p-8 lg:pt-12 lg:pb-16 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Coming Soon Banner */}
          <div className="mb-8 p-4 bg-primary border-4 border-text">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-text text-2xl">construction</span>
              <div>
                <h2 className="text-text font-display font-bold text-lg">Coming Soon</h2>
                <p className="text-text/80 font-mono text-sm">This is a preview of Accountability Tracker. Full functionality launching Q1 2025.</p>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link href="/dashboard" className="text-accent hover:text-text transition-colors">
                  <span className="material-symbols-outlined">arrow_back</span>
                </Link>
                <h1 className="text-text text-3xl lg:text-4xl font-display font-bold tracking-tight">Accountability</h1>
              </div>
              <p className="text-accent font-mono">Stake your commitment. Prove your progress.</p>
            </div>
            <Button disabled className="opacity-50">
              <span className="material-symbols-outlined">add</span>
              New Challenge
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-primary text-2xl mb-1">local_fire_department</span>
                <p className="text-text text-2xl font-display font-bold">14</p>
                <p className="text-accent text-xs font-mono uppercase tracking-wider">Day Streak</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-green-600 text-2xl mb-1">check_circle</span>
                <p className="text-text text-2xl font-display font-bold">82%</p>
                <p className="text-accent text-xs font-mono uppercase tracking-wider">Completion</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-secondary text-2xl mb-1">savings</span>
                <p className="text-text text-2xl font-display font-bold">$175</p>
                <p className="text-accent text-xs font-mono uppercase tracking-wider">At Stake</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center py-4">
                <span className="material-symbols-outlined text-primary text-2xl mb-1">emoji_events</span>
                <p className="text-text text-2xl font-display font-bold">$50</p>
                <p className="text-accent text-xs font-mono uppercase tracking-wider">Won</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Challenges */}
          <div className="mb-8">
            <h2 className="text-text text-xl font-display font-bold mb-4">Your Challenges</h2>
            <div className="space-y-4">
              {mockChallenges.map((challenge) => (
                <Card key={challenge.id} hover>
                  <CardContent>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-text font-display font-bold text-lg">{challenge.title}</h3>
                          <span className={`text-xs font-mono font-bold uppercase px-2 py-0.5 border-2 ${
                            challenge.status === 'active' 
                              ? 'text-blue-600 border-blue-600 bg-blue-100'
                              : 'text-green-600 border-green-600 bg-green-100'
                          }`}>
                            {challenge.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm font-mono text-accent">
                          <span>{challenge.participants} participants</span>
                          <span>·</span>
                          <span>{challenge.duration}</span>
                          <span>·</span>
                          <span className="text-primary font-bold">${challenge.stake} staked</span>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs font-mono mb-1">
                            <span className="text-accent">{challenge.checkIns}/{challenge.requiredCheckIns} check-ins</span>
                            <span className="text-text font-bold">{challenge.progress}%</span>
                          </div>
                          <div className="h-3 bg-background border-2 border-text">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${challenge.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <Button size="sm" disabled className="opacity-50">
                        <span className="material-symbols-outlined">photo_camera</span>
                        Check In
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Leaderboard */}
          <div>
            <h2 className="text-text text-xl font-display font-bold mb-4">Group Leaderboard</h2>
            <Card>
              <CardContent className="p-0">
                <div className="divide-y-2 divide-text/20">
                  {mockLeaderboard.map((entry, i) => (
                    <div 
                      key={entry.user}
                      className={`flex items-center justify-between p-4 ${entry.isYou ? 'bg-primary/10' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`font-mono font-bold text-lg w-8 ${
                          i === 0 ? 'text-yellow-600' : i === 1 ? 'text-gray-500' : i === 2 ? 'text-amber-700' : 'text-accent'
                        }`}>
                          #{i + 1}
                        </span>
                        <img 
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${entry.avatar}`}
                          alt={entry.user}
                          className="w-10 h-10 border-2 border-text"
                        />
                        <div>
                          <p className={`font-mono font-bold ${entry.isYou ? 'text-primary' : 'text-text'}`}>
                            {entry.user}
                          </p>
                          <p className="text-accent text-xs font-mono">
                            🔥 {entry.streak} day streak
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-text font-display font-bold">{entry.completionRate}%</p>
                        <p className="text-accent text-xs font-mono">completion</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

