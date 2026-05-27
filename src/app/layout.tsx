import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { FinancialProvider } from "@/context/FinancialContext";
import { NotificationProvider } from "@/components/ui/notification";
import { AuthProvider } from "@/context/AuthContext";
import { LayoutWrapper } from "@/components/layout/LayoutWrapper";
import { NotificationCenterProvider } from "@/context/NotificationCenterContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Setra",
  description: "Foundational fintech shell with a modern SaaS aesthetic",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-background text-foreground`}>
        <AuthProvider>
          <NotificationCenterProvider>
            <NotificationProvider>
              <FinancialProvider>
                <LayoutWrapper>{children}</LayoutWrapper>
              </FinancialProvider>
            </NotificationProvider>
          </NotificationCenterProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
