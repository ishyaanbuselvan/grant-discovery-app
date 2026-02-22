import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { SavedGrantsProvider } from "@/context/SavedGrantsContext";
import Navigation from "@/components/Navigation";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Luminarts | AI-Powered Arts & Music Grant Discovery",
  description: "Discover classical music grants, performing arts funding, and nonprofit arts opportunities. Luminarts offers AI research tools to analyze foundation websites, filter 50+ verified grants by deadline and budget, and export to Excel. Built for Friday Morning Music Club and arts organizations nationwide.",
  keywords: ["classical music grants", "arts funding", "performing arts grants", "nonprofit grants", "music education funding", "AI grant research", "foundation grants", "NEA grants", "arts organization funding"],
  authors: [{ name: "Friday Morning Music Club" }],
  creator: "Luminarts",
  publisher: "Friday Morning Music Club",
  openGraph: {
    title: "Luminarts | AI-Powered Arts & Music Grant Discovery",
    description: "Discover classical music grants and performing arts funding with AI-powered research tools. Filter 50+ verified grants, analyze foundation websites, and export to Excel.",
    url: "https://luminarts.vercel.app",
    siteName: "Luminarts",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Luminarts | AI-Powered Arts & Music Grant Discovery",
    description: "Discover classical music grants and performing arts funding with AI-powered research tools.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${cormorant.variable} antialiased bg-[var(--background)]`}>
        <SavedGrantsProvider>
          <Navigation />
          <main className="min-h-[calc(100vh-64px)]">
            {children}
          </main>
        </SavedGrantsProvider>
      </body>
    </html>
  );
}
