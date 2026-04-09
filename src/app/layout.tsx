import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koydo GMAT — GMAT Focus Edition Prep",
  description:
    "Free GMAT Focus Edition practice questions for Quantitative, Verbal, and Data Insights with AI analytics.",
  metadataBase: new URL("https://gmat.koydo.app"),
  icons: { icon: "/favicon.svg" },
  manifest: "/manifest.webmanifest",
  other: { "theme-color": "#0D9488" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
