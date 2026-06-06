import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FinancialProvider } from "@/context/FinancialContext";
import { NotificationProvider } from "@/components/ui/notification";
import { AuthProvider } from "@/context/AuthContext";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { NotificationCenterProvider } from "@/context/NotificationCenterContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { InstallPrompt } from "@/components/ui/InstallPrompt";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Setra",
  description: "Foundational fintech shell with a modern SaaS aesthetic",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Setra",
  },
  icons: {
    apple: "/icons/icon-192.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#4361ee",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        <ThemeProvider>
          <AuthProvider>
            <NotificationCenterProvider>
              <NotificationProvider>
                <FinancialProvider>
                  <LayoutWrapper>{children}</LayoutWrapper>
                  <InstallPrompt />
                </FinancialProvider>
              </NotificationProvider>
            </NotificationCenterProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}