import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { QueryProvider } from "@/lib/query-provider";
import { AuthHashHandler } from "@/components/AuthHashHandler";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Energy Capital Match",
  description: "A structured capital and project intelligence platform for energy infrastructure projects",
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
            {children}
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
