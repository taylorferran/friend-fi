'use client';

import { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { AVATAR_OPTIONS, getAvatarUrl } from '@/lib/avatars';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onComplete: (username: string, avatarId: number) => void;
  onSaving?: boolean;
}

export function ProfileSetupModal({ isOpen, onComplete, onSaving }: ProfileSetupModalProps) {
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setSelectedAvatar(AVATAR_OPTIONS[0]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (username.trim()) {
      onComplete(username, selectedAvatar.id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-text/50 backdrop-blur-sm safe-area-inset">
      <div className="w-full max-w-md bg-background border-4 border-text shadow-[8px_8px_0_theme(colors.text)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b-2 border-text bg-primary">
          <h2 className="text-text text-xl sm:text-2xl font-display font-bold mb-2">Welcome to Friend-Fi!</h2>
          <p className="text-text/80 text-xs sm:text-sm font-mono">Set up your profile to get started</p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Preview */}
          <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border-2 border-text bg-surface">
            <img 
              src={getAvatarUrl(selectedAvatar.seed, selectedAvatar.style)} 
              alt="Your avatar"
              className="w-14 h-14 sm:w-16 sm:h-16 border-2 border-text flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-text font-display font-bold text-base sm:text-lg truncate">
                {username || 'Anonymous'}
              </p>
              <p className="text-accent text-xs font-mono">Your profile</p>
            </div>
          </div>

          {/* Name Input */}
          <Input
            label="Display Name"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            hint="This will be visible to your friends"
            autoFocus
          />

          {/* Avatar Grid */}
          <div>
            <label className="text-text text-xs sm:text-sm font-bold font-mono uppercase tracking-wider block mb-2 sm:mb-3">
              Choose Avatar
            </label>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto border-2 border-text p-2 bg-background">
              {AVATAR_OPTIONS.slice(0, 20).map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`relative w-full aspect-square overflow-hidden transition-all border-2 ${
                    selectedAvatar.id === avatar.id
                      ? 'border-primary scale-110 shadow-[2px_2px_0_theme(colors.primary)]'
                      : 'border-text hover:border-primary hover:scale-105'
                  }`}
                >
                  <img 
                    src={getAvatarUrl(avatar.seed, avatar.style)} 
                    alt={`Avatar ${avatar.id}`}
                    className="w-full h-full object-cover"
                  />
                  {selectedAvatar.id === avatar.id && (
                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-text text-sm">check</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t-2 border-text bg-surface">
          <Button 
            onClick={handleSubmit}
            disabled={!username.trim() || onSaving}
            loading={onSaving}
            className="w-full"
          >
            <span className="material-symbols-outlined">check_circle</span>
            {onSaving ? 'Saving...' : 'Complete Setup'}
          </Button>
          <p className="text-accent text-xs font-mono text-center mt-3">
            Your profile will be saved
          </p>
        </div>
      </div>
    </div>
  );
}

