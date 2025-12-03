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
  title: {
    default: "PaelFlix",
    template: "%s | PaelFlix",
  },
  description: "PaelFlix - streaming de filmes, séries e animes estilo Netflix.",
  applicationName: "PaelFlix",
  openGraph: {
    title: "PaelFlix",
    description: "PaelFlix - streaming de filmes, séries e animes estilo Netflix.",
    siteName: "PaelFlix",
    type: "website",
  },
  icons: {
    icon: "/paelflix-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
