import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
