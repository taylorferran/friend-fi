import type { Metadata } from "next";
import { Libre_Baskerville, Space_Mono } from "next/font/google";
import "./globals.css";
import { PrivyProviderWrapper } from "@/components/providers/PrivyProvider";
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
  icons: {
    icon: "/icon.svg",
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
        <link 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" 
          rel="stylesheet" 
        />
        <link rel="prefetch" href="/login" />
        <link rel="prefetch" href="/dashboard" />
      </head>
      <body className={`${libreBaskerville.variable} ${spaceMono.variable} font-mono antialiased`} suppressHydrationWarning>
        <PrivyProviderWrapper>
          <ToastProvider>
            {children}
          </ToastProvider>
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
