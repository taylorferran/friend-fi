'use client';

/**
 * AuthWrapper - No longer blocks routes or redirects
 * All routes are accessible. Individual pages handle their own auth requirements.
 * This allows users to browse the app freely, with login prompts on pages that need it.
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  // Always show content - individual pages handle their own auth requirements
  // This allows users to view pages without being blocked by auth wrapper
  return <>{children}</>;
}

