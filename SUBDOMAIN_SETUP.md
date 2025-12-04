# Subdomain Setup Guide

This app uses subdomain routing:
- **`friend-fi.com`** → Splash page (marketing site)
- **`app.friend-fi.com`** → Application (dashboard, groups, bets, etc.)

## How It Works

### Middleware (`src/middleware.ts`)
- Detects the hostname and routes accordingly
- Redirects `app.friend-fi.com/` → `/dashboard`
- Redirects `friend-fi.com/dashboard` → `app.friend-fi.com/dashboard`
- **Development**: Middleware is skipped on localhost (works normally)

### App URL Utility (`src/lib/app-url.ts`)
- `getAppUrl(path)` - Returns the app subdomain URL for links
- In development: returns relative paths
- In production: returns `https://app.friend-fi.com/path`

## DNS Configuration

You'll need to set up DNS records:

### Main Domain
```
friend-fi.com          A     → Your server IP
www.friend-fi.com      A     → Your server IP (optional)
```

### App Subdomain
```
app.friend-fi.com      A     → Your server IP
```

Or use CNAME if you're using a service like Vercel:
```
app.friend-fi.com      CNAME → cname.vercel-dns.com
```

## Deployment (Vercel Example)

1. **Add both domains in Vercel:**
   - `friend-fi.com`
   - `app.friend-fi.com`

2. **Environment Variables:**
   ```bash
   NEXT_PUBLIC_APP_DOMAIN=app.friend-fi.com
   ```

3. **The middleware will automatically:**
   - Route `friend-fi.com` to the splash page
   - Route `app.friend-fi.com` to the app

## Testing Locally

**Note:** Subdomain routing is **disabled in development** because Privy's embedded wallets require HTTPS. 

In development (`localhost:3000`), you can:
- Access all routes normally (no subdomain routing)
- Test the full app functionality
- The middleware is skipped, so everything works as expected

The subdomain routing will automatically activate when deployed to production with HTTPS.

## Links Updated

All "Go to App" / "Dashboard" buttons on the splash page now link to `app.friend-fi.com/login` using the `getAppUrl()` utility.

