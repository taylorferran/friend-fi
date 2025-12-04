/**
 * Get the app subdomain URL for internal navigation
 * In production: app.friend-fi.com
 * In development: localhost:3000 (no subdomain)
 */
export function getAppUrl(path: string = ''): string {
  if (typeof window === 'undefined') {
    // Server-side: use environment variable or default
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'app.friend-fi.com';
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      return `https://${appDomain}${path}`;
    }
    // Development: return relative path
    return path;
  }

  // Client-side: detect current hostname
  const hostname = window.location.hostname;
  
  // Development: return relative path (no subdomain routing in dev)
  if (hostname === 'localhost' || hostname.includes('localhost') || hostname === '127.0.0.1') {
    return path;
  }

  // Production: use app subdomain
  const appHostname = hostname.replace(/^(www\.)?/, 'app.');
  const protocol = window.location.protocol;
  return `${protocol}//${appHostname}${path}`;
}

/**
 * Get the main site URL (splash page)
 */
export function getMainUrl(path: string = ''): string {
  if (typeof window === 'undefined') {
    return `https://friend-fi.com${path}`;
  }

  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname.includes('localhost')) {
    return path || '/';
  }

  // Remove app subdomain if present
  const mainHostname = hostname.replace(/^app\./, '').replace(/^www\./, '');
  const protocol = window.location.protocol;
  return `${protocol}//${mainHostname}${path}`;
}

