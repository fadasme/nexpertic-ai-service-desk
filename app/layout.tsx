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
    default: "Nexpertic AI Service Desk",
    template: "%s · Nexpertic AI Service Desk",
  },
  description:
    "Plataforma de service desk con vistas por rol, gobierno, automatización y soporte asistido por IA.",
  applicationName: "Nexpertic AI Service Desk",
  icons: {
    apple: "/apple-touch-icon.png",
    icon: "/nexpertic-icon.png",
    shortcut: "/nexpertic-icon.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Nexpertic AI Service Desk",
    description:
      "Plataforma de service desk con vistas por rol, gobierno, automatización y soporte asistido por IA.",
    siteName: "Nexpertic AI Service Desk",
    locale: "es_CL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexpertic AI Service Desk",
    description:
      "Plataforma de service desk con vistas por rol, gobierno, automatización y soporte asistido por IA.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
