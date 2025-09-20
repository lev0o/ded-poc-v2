import type { Metadata } from "next";
import "./globals.css";
import { QueryProvider } from "../components/providers";

export const metadata: Metadata = {
  title: "Fabric Nexus",
  description: "AI-powered Microsoft Fabric data exploration and analysis",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
