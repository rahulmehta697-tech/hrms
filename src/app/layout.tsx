import "./globals.css";
import type { Metadata, Viewport } from "next";
import { getSettings } from "@/lib/settings";
import { PRODUCT } from "@/lib/product";

export async function generateMetadata(): Promise<Metadata> {
  try { const { org } = await getSettings(); return { title: `${org.short || org.name} · ${PRODUCT.name}`, robots: { index: false, follow: false } }; }
  catch { return { title: PRODUCT.name }; }
}
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@500;600;700&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
