import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import "./globals.css";
import Providers from "@/components/Providers";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

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
    default: "Pflix",
    template: "%s | Pflix",
  },
  description: "Pflix - sua plataforma de entretenimento digital.",
  applicationName: "Pflix",
  openGraph: {
    title: "Pflix",
    description: "Pflix - sua plataforma de entretenimento digital.",
    siteName: "Pflix",
    type: "website",
  },
  icons: {
    icon: "/paelflix-favicon.svg",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.json",
  themeColor: "#e50914",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pflix",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Carrega settings e sessão em paralelo
  const [settings, session] = await Promise.all([
    getSettings(),
    getServerSession(authOptions as any),
  ]);

  const isAdmin = Boolean(
    session &&
      (session as any).user &&
      ((session as any).user).role === "ADMIN",
  );

  const inMaintenance = settings.maintenanceMode && !isAdmin;

  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {inMaintenance ? (
          <div className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
            <div className="max-w-md text-center px-6">
              <h1 className="text-3xl font-bold mb-4">
                {settings.siteName || "Pflix"} está em manutenção
              </h1>
              <p className="text-zinc-400 mb-6">
                Estamos realizando ajustes para melhorar sua experiência.
                Tente novamente em alguns minutos.
              </p>
              <p className="text-xs text-zinc-500">
                Se você é administrador, faça login na área admin para continuar.
              </p>
            </div>
          </div>
        ) : (
          <Providers>
            {children}
          </Providers>
        )}
      </body>
    </html>
  );
}
