import type { Metadata } from "next";
import "./globals.css";
import { MonitoringSummaryProvider } from "./monitoring/MonitoringSummaryProvider";
import { Navigation } from "./components/Navigation";

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
      <body className="bg-gray-50 text-gray-900 antialiased">
        <MonitoringSummaryProvider>
          <div className="flex min-h-screen flex-col">
            <Navigation />
            <main className="flex-1">{children}</main>
          </div>
        </MonitoringSummaryProvider>
      </body>
    </html>
  );
}
