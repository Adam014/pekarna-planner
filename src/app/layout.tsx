import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Allo (SIL Open Font License, see _fonts/OFL-allo.txt), based on Inter.
const allo = localFont({
  src: "./_fonts/Allo.woff2",
  weight: "100 900",
  variable: "--font-allo",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Pekárna Planner",
  description: "Rezervace, plán pečení a výdej pro malou pekárnu.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="cs"
      className={`${allo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
