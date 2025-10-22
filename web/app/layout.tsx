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
      <body className="bg-gray-50 text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        <ThemeProvider>
          <ErrorBoundary>
            <MonitoringSummaryProvider>
              <div className="flex min-h-screen">
                <aside className="w-72 shrink-0 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <SectionErrorBoundary section="Navigation">
                    <Navigation />
                  </SectionErrorBoundary>
                </aside>
                <main className="flex flex-1 justify-center">
                  <div className="flex w-full max-w-[1200px] flex-col gap-6 px-8 py-8">
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
