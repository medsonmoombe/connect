import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "@/lib/query-provider";
import { AuthHashHandler } from "@/components/AuthHashHandler";
import { PortalLayoutWrapper } from "@/components/dashboard/PortalLayoutWrapper";
import { Toaster } from "sonner";
import { APP_NAME } from "@/lib/branding";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: "A structured capital and project intelligence platform for energy infrastructure projects",
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/icon.png" }, { url: "/favicon.ico" }],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <QueryProvider>
            <AuthHashHandler />
            <PortalLayoutWrapper>
              {children}
            </PortalLayoutWrapper>
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                style: { fontFamily: 'Inter, sans-serif' },
              }}
            />
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
