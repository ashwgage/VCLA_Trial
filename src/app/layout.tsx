import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "VCLA Clinic Night", template: "%s · VCLA Clinic Night" },
  description: "Real-time client and attorney queue for VCLA legal clinic nights.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1d4ed8" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 text-slate-900">
        <AppHeader />
        <main className="mx-auto w-full max-w-7xl px-4 pt-5 pb-28">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
