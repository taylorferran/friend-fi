import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { PrivyProviderWrapper } from "@/components/providers/PrivyProvider";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Friend-Fi | Social DeFi",
  description: "A suite of social DeFi apps for your inner circle. Wager, compete, and hold each other accountable on Movement Network.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link 
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" 
          rel="stylesheet" 
        />
        {/* Prefetch critical routes */}
        <link rel="prefetch" href="/login" />
        <link rel="prefetch" href="/dashboard" />
      </head>
      <body className={`${manrope.variable} font-sans antialiased`} suppressHydrationWarning>
        <PrivyProviderWrapper>
          {children}
        </PrivyProviderWrapper>
      </body>
    </html>
  );
}
