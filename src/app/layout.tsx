import type { Metadata } from "next";
import { Libre_Baskerville, Space_Mono } from "next/font/google";
import "./globals.css";
import { BiometricAuthWrapper } from "@/components/providers/BiometricAuthWrapper";
import { ToastProvider } from "@/components/ui/Toast";

const libreBaskerville = Libre_Baskerville({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Friend-Fi | Social DeFi",
  description: "A suite of social DeFi apps for your inner circle. Wager, compete, and hold each other accountable on Movement Network.",
  applicationName: "Friend-Fi",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Friend-Fi",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Friend-Fi" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Friend-Fi" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#F5C301" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        
        {/* Fonts */}
        <link 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" 
          rel="stylesheet" 
        />
        
        {/* Prefetch */}
        <link rel="prefetch" href="/login" />
        <link rel="prefetch" href="/dashboard" />
      </head>
      <body className={`${libreBaskerville.variable} ${spaceMono.variable} font-mono antialiased`} suppressHydrationWarning>
        <BiometricAuthWrapper>
          <ToastProvider>
            {children}
          </ToastProvider>
        </BiometricAuthWrapper>
      </body>
    </html>
  );
}
