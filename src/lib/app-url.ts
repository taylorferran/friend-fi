/**
 * Simple URL helper - just returns relative paths
 * No subdomain routing needed
 */
export function getAppUrl(path: string = ''): string {
  return path;
}

/**
 * Get the main site URL
 */
export function getMainUrl(path: string = ''): string {
  return path || '/';
}

