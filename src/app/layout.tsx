import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "CoiffIA",
  description: "Gestion du salon et produits",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "CoiffIA";
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-white text-gray-900`}>
        <header className="border-b bg-white/80 backdrop-blur">
          <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
            <a href="/" className="font-semibold tracking-tight">{appName}</a>
            <div className="flex gap-4 text-sm">
              <a href="/" className="hover:underline">Accueil</a>
              <a href="/products" className="hover:underline">Produits</a>
              <a href="/tenant/demo/products" className="hover:underline">Produits (tenant demo)</a>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
