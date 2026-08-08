import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pulse360 — Performance Review",
  description: "Internal 360° performance review platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
