import type { Metadata } from "next";
import "./globals.css";
import { MonitoringSummaryProvider } from "./monitoring/MonitoringSummaryProvider";
import { Navigation } from "./components/Navigation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "@/hooks/useTheme";
import { SectionErrorBoundary } from "./components/SectionErrorBoundary";

export const metadata: Metadata = {
  title: "Kafka Connect Console",
  description: "A lightweight UI for managing Kafka Connect clusters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[color:var(--background)] text-[color:var(--foreground)] antialiased">
        <ThemeProvider>
          <ErrorBoundary>
            <MonitoringSummaryProvider>
              <div className="flex min-h-screen">
                <aside className="w-72 shrink-0 border-r border-[color:var(--border-muted)] bg-[color:var(--surface)]">
                  <SectionErrorBoundary section="Navigation">
                    <Navigation />
                  </SectionErrorBoundary>
                </aside>
                <main className="flex flex-1 justify-center bg-[color:var(--background)]">
                  <div className="flex w-full max-w-[1200px] flex-col gap-6 px-6 py-8">
                    <SectionErrorBoundary section="Page Content">
                      {children}
                    </SectionErrorBoundary>
                  </div>
                </main>
              </div>
            </MonitoringSummaryProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
