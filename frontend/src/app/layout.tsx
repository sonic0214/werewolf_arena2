import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Werewolf Arena",
  description: "AI-powered Werewolf game arena",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="min-h-screen bg-gray-50">
          {children}
        </div>
      </body>
    </html>
  );
}
