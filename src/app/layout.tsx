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
  title: "Luminarts | Friday Morning Music Club",
  description: "Grant Discovery & Analysis Platform for Classical Music Organizations",
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
