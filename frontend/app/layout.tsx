import type { Metadata } from "next";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "EUKOV — Foundation Platform",
  description: "EUKOV Phase 1 foundation platform setup",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
