# Mobile Optimization Quick Reference

## 🎨 Key Mobile CSS Classes

### Safe Area Padding
```tsx
// Use these for elements at screen edges
<header className="safe-area-pt">  // Top padding for notch
<footer className="safe-area-pb">  // Bottom padding for home indicator
```

### Mobile Content Wrapper
```tsx
// Main content that needs spacing from nav bars
<main className="mobile-content">
  // Content here
</main>
```

This automatically adds:
- Top padding: 72px (header height)
- Bottom padding: 88px (nav height)
- Horizontal padding: 1rem
- On desktop: all removed automatically

### Touch-Friendly Elements
```tsx
// Buttons automatically sized for touch
<button className="mobile-touch">
  // Minimum 44px x 44px
</button>
```

---

## 📱 Responsive Breakpoints

Tailwind breakpoints used:
- `sm`: 640px - Small tablets
- `md`: 768px - Tablets
- `lg`: 1024px - **Desktop (sidebar shows)**
- `xl`: 1280px - Large desktop
- `2xl`: 1536px - Extra large

**Critical breakpoint: `lg` (1024px)**
- Below: Mobile nav (bottom bar + top header)
- Above: Desktop sidebar

---

## 🧭 Navigation Components

### Mobile (< 1024px)
1. **Top Header** (`Sidebar.tsx`)
   - Logo on left
   - Balance + avatar on right
   - Fixed to top
   - 72px height (with safe area)

2. **Bottom Nav** (`MobileNav.tsx`)
   - 4 main nav items
   - Center FAB button (create)
   - Fixed to bottom
   - 88px height (with safe area)

### Desktop (≥ 1024px)
- Sidebar on left (288px width)
- No mobile header/nav
- Full height sidebar

---

## ✨ Mobile-Optimized Components

### Cards
```tsx
<Card className="mobile-card-spacing">
  // Auto-adjusts padding on mobile
</Card>
```

### Typography
- H1: 30px on mobile, scales up on desktop
- H2: 24px on mobile
- H3: 20px on mobile
- Body: 16px (prevents iOS zoom)

### Buttons
```tsx
// Stacked on mobile, row on desktop
<div className="flex flex-col sm:flex-row gap-3">
  <Button>First</Button>
  <Button>Second</Button>
</div>
```

---

## 🔧 Common Mobile Patterns

### Full-Width on Mobile, Contained on Desktop
```tsx
<div className="w-full max-w-4xl mx-auto px-4">
  // Content
</div>
```

### Grid: 1 col mobile, 2+ desktop
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  // Cards
</div>
```

### Hide on Mobile, Show on Desktop
```tsx
<div className="hidden lg:block">
  // Desktop only content
</div>
```

### Show on Mobile, Hide on Desktop
```tsx
<div className="lg:hidden">
  // Mobile only content
</div>
```

---

## 📏 Spacing Recommendations

### Page Padding
```tsx
// Mobile
className="px-4 py-6"

// Responsive
className="px-4 py-6 lg:px-8 lg:py-12"
```

### Section Gaps
```tsx
// Small: gap-2 (8px)
// Medium: gap-4 (16px)  ← Most common
// Large: gap-6 (24px)
// Extra: gap-8 (32px)
```

---

## 🎯 Mobile UX Best Practices

### 1. Touch Targets
- Minimum 44x44px (Apple guideline)
- Add padding, not just icon size
```tsx
<button className="p-3"> {/* 44px+ with icon */}
  <Icon />
</button>
```

### 2. Input Fields
```tsx
<Input
  className="text-base" // 16px prevents zoom
  type="text"
/>
```

### 3. Modal/Dialog Spacing
```tsx
<div className="p-4 max-w-lg w-full">
  // Leave breathing room
</div>
```

### 4. Loading States
```tsx
<div className="min-h-screen flex items-center justify-center">
  <Spinner />
</div>
```

---

## 🚀 Performance Tips

### 1. Lazy Load Images
```tsx
<img loading="lazy" src={url} />
```

### 2. Reduce Motion
```tsx
// Animations automatically reduced via CSS
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; }
}
```

### 3. Optimize Fonts
Already configured:
- `display: swap` - show fallback immediately
- Preload key fonts in `layout.tsx`

---

## 🧪 Testing Checklist

### Mobile Devices to Test
- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (iPad/Android)

### Orientations
- [ ] Portrait
- [ ] Landscape

### Screen Sizes
- [ ] Small (320px - iPhone SE)
- [ ] Medium (375px - iPhone)
- [ ] Large (428px - iPhone Pro Max)
- [ ] Tablet (768px+)

### Features
- [ ] Install to home screen
- [ ] Navigation works
- [ ] Forms are usable
- [ ] No horizontal scroll
- [ ] Touch targets work
- [ ] Safe areas respected

---

## 🐛 Common Mobile Issues & Fixes

### Issue: Text too small
```tsx
// ❌ Bad
<p className="text-xs">...</p>

// ✅ Good
<p className="text-sm sm:text-base">...</p>
```

### Issue: Horizontal scrolling
```tsx
// ❌ Bad
<div className="w-screen">...</div>

// ✅ Good
<div className="w-full overflow-x-hidden">...</div>
```

### Issue: Content under navigation
```tsx
// ❌ Bad
<main className="pt-4">...</main>

// ✅ Good
<main className="mobile-content">...</main>
```

### Issue: Buttons too close
```tsx
// ❌ Bad
<div className="flex gap-1">

// ✅ Good
<div className="flex gap-3 sm:gap-4">
```

---

## 📱 PWA-Specific Notes

### Standalone Mode
When installed as PWA, app runs in standalone mode:
- No browser UI (address bar, etc.)
- Fullscreen experience
- Use `safe-area-*` classes for notch/home indicator

### Testing Standalone Mode
Chrome DevTools:
1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M)
3. Click menu (⋮) → "More tools" → "Application"
4. Check "Manifest" tab

### Service Worker
Dev mode: Disabled (hot reload needed)
Production: Enabled automatically

---

## 🎨 Mobile Design Patterns in App

### Dashboard
- Stacked layout on mobile
- Grid on desktop (2-3 columns)
- Cards full width on mobile

### Forms
- Stacked labels + inputs
- Full-width buttons
- Clear spacing between fields

### Modals
- Full screen on small mobile
- Centered card on desktop
- Easy to dismiss

### Navigation
- Bottom tabs (primary)
- FAB for main actions
- Settings/profile in header

---

Your app now follows all mobile best practices! 🎉

